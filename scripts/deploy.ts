/**
 * @file Smart Contract Deployment Script
 * @description Deploys KeyRegistry and PatientRecordsFactory contracts
 */

import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Deploying Smart Contracts...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const [deployer] = await ethers.getSigners();

  console.log('🔑 Deploying with account:', deployer.address);
  console.log('💰 Account balance:', ethers.utils.formatEther(await deployer.getBalance()), 'ETH\n');

  // Deploy KeyRegistry
  console.log('1️⃣  Deploying KeyRegistry...');
  const KeyRegistry = await ethers.getContractFactory('KeyRegistry');
  const keyRegistry = await KeyRegistry.deploy();
  await keyRegistry.deployed();
  console.log('✅ KeyRegistry deployed to:', keyRegistry.address);
  console.log('   Transaction hash:', keyRegistry.deployTransaction.hash);
  console.log('   Gas used:', (await keyRegistry.deployTransaction.wait()).gasUsed.toString(), '\n');

  // Deploy PatientRecordsFactory
  console.log('2️⃣  Deploying PatientRecordsFactory...');
  const PatientRecordsFactory = await ethers.getContractFactory('PatientRecordsFactory');
  const factory = await PatientRecordsFactory.deploy();
  await factory.deployed();
  console.log('✅ PatientRecordsFactory deployed to:', factory.address);
  console.log('   Transaction hash:', factory.deployTransaction.hash);
  console.log('   Gas used:', (await factory.deployTransaction.wait()).gasUsed.toString(), '\n');

  // Save deployment addresses
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      KeyRegistry: {
        address: keyRegistry.address,
        transactionHash: keyRegistry.deployTransaction.hash,
      },
      PatientRecordsFactory: {
        address: factory.address,
        transactionHash: factory.deployTransaction.hash,
      },
    },
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to file
  const filename = `deployment-${deploymentInfo.chainId}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // Also save as latest
  const latestFilepath = path.join(deploymentsDir, 'latest.json');
  fs.writeFileSync(latestFilepath, JSON.stringify(deploymentInfo, null, 2));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Deployment Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 Deployment Summary:');
  console.log('   Network:', deploymentInfo.network);
  console.log('   Chain ID:', deploymentInfo.chainId);
  console.log('   Deployer:', deploymentInfo.deployer);
  console.log('\n📝 Contract Addresses:');
  console.log('   KeyRegistry:', keyRegistry.address);
  console.log('   PatientRecordsFactory:', factory.address);
  console.log('\n💾 Deployment info saved to:', filepath);
  console.log('\n⚙️  Next Steps:');
  console.log('   1. Update .env file with contract addresses:');
  console.log(`      KEY_REGISTRY_ADDRESS=${keyRegistry.address}`);
  console.log(`      FACTORY_CONTRACT_ADDRESS=${factory.address}`);
  console.log('   2. Start the backend server: npm run dev');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
