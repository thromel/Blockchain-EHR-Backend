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

router.post('/', async (req, res) => {
  const {
    encryptedData,
    recordHash,
    encryptedKey,
    signature,
    patientRecordsAddress,
    walletAddress,
  } = req.body;

  console.log(req.body);

  const recordHash32 = ethers.utils.arrayify('0x' + recordHash);

  try {
    const patientRecord = new ethers.Contract(
      patientRecordsAddress,
      PATIENT_RECORDS_ABI,
      signer
    );

    // Now you can use arrayify with the hexadecimal string
    const byteArray = ethers.utils.arrayify('0x' + encryptedKey);
    const tx = await patientRecord.addRecord(
      recordHash32,
      byteArray,
      signature
    );
    const receipt = await tx.wait();
    console.log(receipt.events);
    const event = receipt.events.find((e) => e.event === 'RecordAdded');
    const index = event.args.recordIndex.toNumber();

    // const encryptedKeyHexString = `E'\\\\x${encryptedKey}'`;
    // const encryptedDataHexString = `E'\\\\x${encryptedData}'`;
    const encryptedKeyBuffer = Buffer.from(encryptedKey, 'hex');
    const encryptedDataBuffer = Buffer.from(encryptedData, 'hex');

    const query = `
      INSERT INTO records(wallet_address, patient_record_address, blockchain_index, record_hash, encrypted_data, encrypted_aes_key)
      VALUES($1, $2, $3, $4, $5, $6)
    `;
    const values = [
      walletAddress,
      patientRecordsAddress,
      index,
      recordHash,
      encryptedDataBuffer,
      encryptedKeyBuffer,
    ];

    try {
      const result = await pool.query(query, values);

      const data = await pool.query(
        `SELECT * FROM records WHERE record_hash = '${recordHash}'`
      );
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: 'Error storing record in the database' });
    }

    res.status(201).json({ success: true, txHash: tx.hash, tx });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error adding record' });
  }
});

module.exports = router;
