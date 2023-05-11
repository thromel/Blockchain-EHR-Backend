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
    patientWalletAddress,
    doctorWalletAddress,
    doctorPublicKey,
    description,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO permissions (patient_wallet_address, doctor_wallet_address, doctor_public_key, description, timestamp, status) 
        VALUES ($1, $2, $3, $4, NOW(), 'pending') RETURNING *`,
      [patientWalletAddress, doctorWalletAddress, doctorPublicKey, description]
    );

    res
      .status(200)
      .json({ message: 'Request added successfully', request: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
