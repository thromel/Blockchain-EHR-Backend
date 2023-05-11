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
  const { walletAddress, password } = req.body;

  try {
    // Check if user exists
    const user = await pool.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    );
    console.log(user.rows[0]);

    if (user.rows.length === 0) {
      return res.status(401).json('Invalid Credential');
    }

    // Check if incoming password is the same as the DB password
    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password_hash
    );
    if (!validPassword) {
      return res.status(401).json('Invalid Credential');
    }

    res.status(200).json({ message: 'Logged in successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
