const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const cors = require('cors');
const app = express();
const port = 3000;
const encryption = require('./utils/encryption');
const { Pool } = require('pg');
const pool = require('./utils/db');

//Import the PatientRecordsFactory ABI JSON
const PatientRecordFactory = require('./artifacts/contracts/PatientRecordFactory.sol/PatientRecordFactory.json');
const PatientRecords = require('./artifacts/contracts/PatientRecords.sol/PatientRecords.json');
//Import contract address stored at config.dev.json
const config = require('./config.dev.json');

//Import the Routes
const addRecord = require('./routes/addRecord');
const signup = require('./routes/signup');
const findPatientRecordAddress = require('./routes/findPatientRecordAddress');
const getRecord = require('./routes/getRecord');
const getAllRecords = require('./routes/getAllRecords');
const permission = require('./routes/permission');
const signin = require('./routes/signin');
const addRequest = require('./routes/addRequest');
const getAllRequests = require('./routes/getAllRequests');

//Constants
const RPC_URL = 'http://127.0.0.1:8545/';
const FACTORY_ABI = PatientRecordFactory.abi;
const FACTORY_ADDRESS = config.factoryContractAddress; // Replace with the deployed PatientRecordsFactory address
const PATIENT_RECORDS_ABI = PatientRecords.abi;

app.use(cors());
app.use(bodyParser.json());

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = provider.getSigner(); // You can also use a specific signer from a private key or mnemonic

app.use('/', findPatientRecordAddress);

app.use('/signup', signup);

app.use('/signin', signin);

app.use('/patient/record/add', addRecord);

app.use('/patient/record/get', getRecord);

app.use('/patient/record/getAll', getAllRecords);

app.use('/patient/record/permission', addRequest);

app.use('/patient/record/requests', getAllRequests);

app.listen(port, () => {
  pool
    .connect()
    .then(() => console.log('Connected successfully'))
    .catch((e) => console.log(e));

  console.log(`API listening at http://localhost:${port}`);
});
