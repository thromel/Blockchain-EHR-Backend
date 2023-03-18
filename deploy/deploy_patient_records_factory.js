// deploy/deploy_patient_records_factory.js

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  const PatientRecordsFactory = await ethers.getContractFactory(
    'PatientRecordsFactory'
  );
  const patientRecordsFactory = await PatientRecordsFactory.deploy();

  console.log('PatientRecordsFactory address:', patientRecordsFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
