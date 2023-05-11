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
  const {
    walletAddress,
    firstName,
    lastName,
    address,
    dob,
    email,
    password,
    role,
    publicKeyPem,
  } = req.body;
  console.log(req.body);

  //TODO:Add validation for all fields

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    pool.query(
      'INSERT INTO users (wallet_address, name, date_of_birth, address, email, password_hash, role, rsa_public_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        walletAddress,
        firstName + ' ' + lastName,
        dob,
        address,
        email,
        passwordHash,
        role,
        publicKeyPem,
      ],
      (error, results) => {
        if (error) {
          throw error;
        }
      }
    );

    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    const tx = await factory.createPatientRecords(walletAddress);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    // Get the deployed PatientRecords contract address from the event logs
    const event = receipt.events.find(
      (e) => e.event === 'PatientRecordsCreated'
    );
    const patientRecordsAddress = event.args.patientRecords;

    console.log(event);

    res.status(201).json({ patientRecordsAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deploying PatientRecords contract' });
  }
});

module.exports = router;
