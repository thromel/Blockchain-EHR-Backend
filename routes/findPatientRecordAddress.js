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

router.get('/patient/find/:userWalletAddress', async (req, res) => {
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

module.exports = router;
