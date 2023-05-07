const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('PatientRecords', function () {
  let PatientRecords,
    patientRecords,
    patient,
    nonPatient,
    recordHash,
    encryptedKey,
    signature;

  beforeEach(async () => {
    PatientRecords = await ethers.getContractFactory('PatientRecords');
    [patient, nonPatient] = await ethers.getSigners();
    recordHash = ethers.utils.keccak256('0x123456');
    encryptedKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    patientRecords = await PatientRecords.deploy(patient.address);

    // Sign the message with the patient's private key
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('Add record'));
    const messageHash = ethers.utils.arrayify(ethers.utils.hashMessage(hash));
    signature = await patient.signMessage(messageHash);
  });

  it('Should add a new record for the patient', async function () {
    const addRecordTx = await patientRecords
      .connect(patient)
      .addRecord(recordHash, encryptedKey, signature);

    await expect(addRecordTx)
      .to.emit(patientRecords, 'Transfer')
      .withArgs(ethers.constants.AddressZero, patient.address, 0);

    expect(await patientRecords.tokenURI(0)).to.equal(
      `ipfs://${ethers.utils.hexStripZeros(recordHash)}`
    );
    expect(await patientRecords.tokenMetadata(0)).to.equal(encryptedKey);
  });

  it('Should not add a record for a non-patient', async function () {
    await expect(
      patientRecords
        .connect(nonPatient)
        .addRecord(recordHash, encryptedKey, signature)
    ).to.be.revertedWith('Only the patient can add records.');
  });
});
