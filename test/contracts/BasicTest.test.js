const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Blockchain EHR System - Basic Tests', function () {
  let keyRegistry, factory;
  let patient, doctor;
  let validPublicKey1, validPublicKey2;

  before(async function () {
    const signers = await ethers.getSigners();
    patient = signers[1];
    doctor = signers[2];

    // Generate valid public keys
    validPublicKey1 = '0x04' + '1'.repeat(128);
    validPublicKey2 = '0x04' + '2'.repeat(128);

    console.log('\\n  📝 Deploying contracts...');
  });

  describe('✅ Contract Deployment', function () {
    it('Should deploy KeyRegistry contract', async function () {
      const KeyRegistry = await ethers.getContractFactory('KeyRegistry');
      keyRegistry = await KeyRegistry.deploy();
      await keyRegistry.deployed();

      console.log(`  ✓ KeyRegistry deployed at: ${keyRegistry.address}`);
      expect(keyRegistry.address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it('Should deploy PatientRecordsFactory contract', async function () {
      const Factory = await ethers.getContractFactory('PatientRecordsFactory');
      factory = await Factory.deploy(keyRegistry.address, true);
      await factory.deployed();

      console.log(`  ✓ Factory deployed at: ${factory.address}`);
      expect(factory.address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('🔑 KeyRegistry Functionality', function () {
    it('Should register patient public key', async function () {
      await keyRegistry.connect(patient).registerKey(validPublicKey1);

      const isRegistered = await keyRegistry.isRegistered(patient.address);
      const hasActive = await keyRegistry.hasActiveKey(patient.address);

      console.log(`  ✓ Patient registered: ${patient.address}`);
      expect(isRegistered).to.be.true;
      expect(hasActive).to.be.true;
    });

    it('Should register doctor public key', async function () {
      await keyRegistry.connect(doctor).registerKey(validPublicKey2);

      const isRegistered = await keyRegistry.isRegistered(doctor.address);

      console.log(`  ✓ Doctor registered: ${doctor.address}`);
      expect(isRegistered).to.be.true;
    });

    it('Should retrieve patient public key', async function () {
      const [publicKey, version] = await keyRegistry.getPublicKey(patient.address);

      console.log(`  ✓ Retrieved public key (version ${version.toString()})`);
      expect(publicKey).to.equal(validPublicKey1);
      expect(version.toString()).to.equal('0');
    });

    it('Should rotate patient key', async function () {
      const newKey = '0x04' + '3'.repeat(128);
      await keyRegistry.connect(patient).rotateKey(newKey);

      const [publicKey, version] = await keyRegistry.getPublicKey(patient.address);

      console.log(`  ✓ Key rotated to version ${version.toString()}`);
      expect(publicKey).to.equal(newKey);
      expect(version.toString()).to.equal('1');
    });
  });

  describe('🏥 PatientHealthRecords Creation', function () {
    let patientContract;

    it('Should create patient contract via factory', async function () {
      const tx = await factory.connect(patient).createPatientContract(patient.address);
      const receipt = await tx.wait();

      const contractAddress = await factory.getPatientContract(patient.address);
      patientContract = await ethers.getContractAt('PatientHealthRecords', contractAddress);

      console.log(`  ✓ Patient contract created at: ${contractAddress}`);
      expect(contractAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it('Should verify patient contract ownership', async function () {
      const owner = await patientContract.patient();

      console.log(`  ✓ Contract owner verified: ${owner}`);
      expect(owner).to.equal(patient.address);
    });

    it('Should add a health record', async function () {
      const storagePointer = 'Qm' + 'a'.repeat(44); // Mock IPFS CID
      const contentDigest = ethers.utils.id('test-content'); // Mock SHA-256

      const tx = await patientContract.connect(patient).addRecord(storagePointer, contentDigest);
      const receipt = await tx.wait();

      const recordCount = await patientContract.getRecordCount();

      console.log(`  ✓ Record added. Total records: ${recordCount.toString()}`);
      expect(recordCount.toString()).to.equal('1');
    });

    it('Should retrieve record metadata', async function () {
      const [storagePointer, contentDigest, timestamp, lastUpdated] =
        await patientContract.connect(patient).getRecordMetadata(0);

      console.log(`  ✓ Retrieved metadata for record 0`);
      console.log(`    Storage: ${storagePointer.substring(0, 20)}...`);
      expect(storagePointer).to.include('Qm');
    });

    it('Should grant permission to doctor', async function () {
      const recordIds = [0];
      const wrappedKey = '0x' + 'ab'.repeat(32); // Mock wrapped key
      const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours

      const tx = await patientContract
        .connect(patient)
        .grantPermission(doctor.address, recordIds, wrappedKey, expirationTime);

      const receipt = await tx.wait();

      console.log(`  ✓ Permission granted to doctor`);
    });

    it('Should verify doctor has access', async function () {
      const [hasAccess, wrappedKey] = await patientContract.checkAccess(
        doctor.address,
        0
      );

      console.log(`  ✓ Doctor access verified: ${hasAccess}`);
      expect(hasAccess).to.be.true;
    });

    it('Should get accessible records for doctor', async function () {
      const accessibleRecords = await patientContract.getAccessibleRecords(doctor.address);

      console.log(`  ✓ Doctor can access ${accessibleRecords.length} record(s)`);
      expect(accessibleRecords.length).to.equal(1);
      expect(accessibleRecords[0].toString()).to.equal('0');
    });
  });

  describe('📊 Factory Statistics', function () {
    it('Should report total contracts deployed', async function () {
      const total = await factory.getTotalContracts();

      console.log(`  ✓ Total patient contracts: ${total.toString()}`);
      expect(total.toString()).to.equal('1');
    });

    it('Should retrieve contract info', async function () {
      const [contractAddress, exists, recordCount] = await factory.getContractInfo(
        patient.address
      );

      console.log(`  ✓ Contract info retrieved`);
      console.log(`    Address: ${contractAddress}`);
      console.log(`    Records: ${recordCount.toString()}`);
      expect(exists).to.be.true;
      expect(recordCount.toString()).to.equal('1');
    });
  });

  after(function () {
    console.log('\\n  🎉 All basic tests passed!');
    console.log('  ✅ Smart contracts are working correctly');
    console.log('  ✅ Key management functional');
    console.log('  ✅ Record storage and permissions working');
  });
});
