const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();

const PatientRecordFactory = require('../artifacts/contracts/PatientRecordFactory.sol/PatientRecordFactory.json');
const PatientRecords = require('../artifacts/contracts/PatientRecords.sol/PatientRecords.json');
//Import contract address stored at config.dev.json
const config = require('../config.dev.json');

const RPC_URL = 'http://127.0.0.1:8545/';
const FACTORY_ABI = PatientRecordFactory.abi;
const FACTORY_ADDRESS = config.factoryContractAddress; // Replace with the deployed PatientRecordsFactory address
const PATIENT_RECORDS_ABI = PatientRecords.abi;
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = provider.getSigner();

const pool = require('../utils/db.js');

router.get('/', async (req, res) => {
  try {
    const { walletAddress, patientRecordsAddress } = req.query;

    console.log(req.query);

    const signer = provider.getSigner(walletAddress);
    const contract = new ethers.Contract(
      patientRecordsAddress,
      PATIENT_RECORDS_ABI,
      signer
    );

    const records = [];

    const totalNumberOfRecords = await contract.getRecordCount();
    console.log('totalNumberOfRecords: ', totalNumberOfRecords);

    for (let i = 0; i < totalNumberOfRecords; i++) {
      const recordData = await contract.getRecordByIndex(i);

      const result = await pool.query(
        `SELECT encrypted_data FROM records WHERE record_hash = '${recordData.recordHash.slice(
          2
        )}'`
      );

      records.push({
        recordHash: recordData.recordHash,
        recordMetadata: recordData.recordMetadata,
        encryptedData: result.rows[0].encrypted_data.toString('hex'),
      });
    }

    res.json({
      records,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch the record' });
  }
});

module.exports = router;
