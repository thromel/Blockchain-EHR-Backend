const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const cors = require('cors');
const app = express();
const port = 3000;
const encryption = require('./utils/encryption');
const { Pool } = require('pg');
const db = require('./utils/db');

//Import the PatientRecordsFactory ABI JSON
const PatientRecordFactory = require('./artifacts/contracts/PatientRecordFactory.sol/PatientRecordFactory.json');
const PatientRecords = require('./artifacts/contracts/PatientRecords.sol/PatientRecords.json');
//Import contract address stored at config.dev.json
const config = require('./config.dev.json');
const { ColumnSet } = require('pg-promise');

app.use(cors());
app.use(bodyParser.json());

const RPC_URL = 'http://127.0.0.1:8545/';
const FACTORY_ABI = PatientRecordFactory.abi;
const FACTORY_ADDRESS = config.factoryContractAddress; // Replace with the deployed PatientRecordsFactory address
const PATIENT_RECORDS_ABI = PatientRecords.abi;
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = provider.getSigner(); // You can also use a specific signer from a private key or mnemonic

//A simple endpoint to test the API
app.get('/', (req, res) => {
  //Get the current block number

  console.log(req.body);

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

app.post('/patient/signup', async (req, res) => {
  const { walletAddress, firstName, lastName, email, password } = req.body;
  console.log(req.body);

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

    if (patientRecordAddress != ethers.constants.AddressZero) {
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

async function signMessage(message, signer) {
  const messageHash = ethers.utils.id(message);
  const signature = await signer.signMessage(
    ethers.utils.arrayify(messageHash)
  );
  return signature;
}

app.get('/patient/record/get', async (req, res) => {
  try {
    const { walletAddress, index, patientContractAddress } = req.query;
    console.log(req.query);
    const signer = provider.getSigner(walletAddress);
    const contract = new ethers.Contract(
      patientContractAddress,
      PATIENT_RECORDS_ABI,
      signer
    );

    const recordData = await contract.getRecordByIndex(index);
    const tokenId = recordData.tokenId;
    const recordURI = recordData.recordURI;
    const recordMetadata = ethers.utils.toUtf8String(recordData.recordMetadata);

    res.json({ tokenId, recordURI, recordMetadata });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch the record' });
  }
});

app.post('/patient/record', async (req, res) => {
  const {
    recordHash,
    encryptedKey,
    signature,
    patientRecordAddress,
    walletAddress,
  } = req.body;

  // TODO: Testing Code -- Remove Later - START
  console.log(req.body);

  if (signature === undefined) {
    const privateKey =
      '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e'; // Replace with the actual private key of the patientAddress
    const signer = new ethers.Wallet(privateKey, provider);
    const message = 'Add record';

    signMessage(message, signer)
      .then((signature) => {
        console.log('Signature:', signature);
      })
      .catch((error) => {
        console.error('Error signing message:', error);
      });
  }
  const recordHash32 = ethers.utils.formatBytes32String(recordHash);
  // const bytes = ethers.utils.toUtf8Bytes(recordHash32);
  // const hexStr = ethers.utils.hexlify(bytes);

  const bytes1 = ethers.utils.toUtf8Bytes(encryptedKey);
  const hexStr1 = ethers.utils.hexlify(bytes1);

  // TODO: TESTING CODE -- REMOVE LATER -- END

  try {
    const patientRecord = new ethers.Contract(
      patientRecordAddress,
      PATIENT_RECORDS_ABI,
      signer
    );

    const tx = await patientRecord.addRecord(recordHash32, hexStr1, signature);
    await tx.wait();
    res.status(201).json({ success: true, txHash: tx.hash, tx });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error adding record' });
  }
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);

  // try {
  //   db.query('SELECT 1');
  //   console.log('Connected to PostgreSQL database');
  // } catch (error) {
  //   console.error('Error connecting to PostgreSQL database:', error);
  // }
});
