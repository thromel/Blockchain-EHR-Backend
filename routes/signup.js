const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();
const bcrypt = require('bcrypt');

const PatientRecordFactory = require('../artifacts/contracts/PatientRecordFactory.sol/PatientRecordFactory.json');
const PatientRecords = require('../artifacts/contracts/PatientRecords.sol/PatientRecords.json');
//Import contract address stored at config.dev.json
const config = require('../config.dev.json');

const RPC_URL = 'http://127.0.0.1:8545/';
const FACTORY_ABI = PatientRecordFactory.abi;
const FACTORY_ADDRESS = config.factoryContractAddress; // Replace with the deployed PatientRecordsFactory address
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = provider.getSigner();

const pool = require('../utils/db.js');

router.post('/', async (req, res) => {
  const { walletAddress, firstName, lastName, address, dob, email, password } =
    req.body;
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
    const passwordHash = await bcrypt.hash(password, 10);

    pool.query(
      'INSERT INTO patients (wallet_address, name, date_of_birth, address, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        walletAddress,
        firstName + ' ' + lastName,
        dob,
        address,
        email,
        passwordHash,
      ],
      (error, results) => {
        if (error) {
          throw error;
        }
        console.log('Patient added with Wallet Address: ', walletAddress);
      }
    );

    res.status(201).json({ patientRecordsAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deploying PatientRecords contract' });
  }
});

module.exports = router;
