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
    const { walletAddress, index, patientRecordsAddress } = req.query;

    console.log(req.query);

    const signer = provider.getSigner(walletAddress);
    const contract = new ethers.Contract(
      patientRecordsAddress,
      PATIENT_RECORDS_ABI,
      signer
    );

    const recordData = await contract.getRecordByIndex(index);
    const recordHash = recordData.recordHash;
    const recordMetadata = recordData.recordMetadata;

    const result = await pool.query(
      `SELECT * FROM records WHERE record_hash = '${recordHash.slice(2)}'`
    );

    console.log(result.rows[0]);
    console.log(recordHash);
    const encryptedData = result.rows[0].encrypted_data.toString('hex');

    res.json({
      recordHash,
      encryptedSymmetricKey: recordMetadata,
      encryptedData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch the record' });
  }
});

module.exports = router;
