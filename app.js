const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const app = express();
const port = 3000;

const { Pool } = require('pg');

//Import the PatientRecordsFactory ABI JSON
const PatientRecordFactory = require('./artifacts/contracts/PatientRecordFactory.sol/PatientRecordFactory.json');
//Import contract address stored at config.dev.json
const config = require('./config.dev.json');

const pool = new Pool({
  user: 'your_username',
  host: 'your_host',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

app.use(bodyParser.json());

const RPC_URL = 'http://127.0.0.1:8545/';
const FACTORY_ABI = PatientRecordFactory.abi;
const FACTORY_ADDRESS = config.factoryContractAddress; // Replace with the deployed PatientRecordsFactory address

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = provider.getSigner(); // You can also use a specific signer from a private key or mnemonic

//A simple endpoint to test the API
app.get('/', (req, res) => {
  //Get the current block number

  provider
    .getBlockNumber()
    .then((blockNumber) => {
      res.json({ blockNumber });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: 'Error getting block number' });
    });
});

app.post('/signup', async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    res.status(400).json({ error: 'Missing wallet address' });
    return;
  }

  try {
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    const tx = await factory.createPatientRecords(walletAddress);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    // Get the deployed PatientRecords contract address from the event logs
    const event = receipt.events.find(
      (e) => e.event === 'PatientRecordsCreated'
    );

    console.log(event);
    const patientRecordsAddress = event.args.patientRecords;
    res.status(201).json({ patientRecordsAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deploying PatientRecords contract' });
  }
});

app.get('/patient/:userWalletAddress', async (req, res) => {
  try {
    const userWalletAddress = req.params.userWalletAddress;

    console.log(userWalletAddress);

    // Get the contract instance
    const patientRecordFactory = new ethers.Contract(
      FACTORY_ADDRESS,
      FACTORY_ABI,
      signer
    );

    // Call the getPatientRecordByUser function
    const patientRecordAddress =
      await patientRecordFactory.getPatientRecordByUser(userWalletAddress);

    if (patientRecordAddress) {
      res.status(200).send({
        success: true,
        message: 'PatientRecords contract address retrieved successfully.',
        patientRecordAddress: patientRecordAddress,
      });
    } else {
      res.status(404).send({
        success: false,
        message:
          'PatientRecords contract not found for the given user address.',
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message:
        'Error occurred while fetching the PatientRecords contract address.',
      error: error.message,
    });
  }
});

app.post('/patient/add', async (req, res) => {
  try {
    const { data, publicKey } = req.body;

    // Encrypt the data using the public key
    const buffer = Buffer.from(data, 'utf-8');
    const encryptedData = crypto.publicEncrypt(publicKey, buffer);

    // Store the encrypted data in PostgreSQL
    const insertQuery =
      'INSERT INTO encrypted_data (data) VALUES ($1) RETURNING id';
    const { rows } = await pool.query(insertQuery, [
      encryptedData.toString('base64'),
    ]);

    // Return the unique identifier
    res.status(201).json({
      message: 'Encrypted data stored successfully',
      dataId: rows[0].id,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred while processing the request' });
  }
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
