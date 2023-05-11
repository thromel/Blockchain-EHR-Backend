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
    const receipt = await tx.wait();

    const event = receipt.events.find((e) => e.event === 'RecordAdded');
    const index = event.args.recordIndex.toNumber();

    const query = `
      INSERT INTO records(wallet_address, patient_record_address, blockchain_index, record_hash, encrypted_data, encrypted_aes_key)
      VALUES($1, $2, $3, $4, $5, $6)
    `;
    const values = [
      walletAddress,
      patientRecordAddress,
      index,
      recordHash,
      encryptedData,
      encryptedKey,
    ];

    try {
      await pool.query(query, values);
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
