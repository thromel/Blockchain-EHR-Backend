"use strict";
/**
 * @file Smart Contract Deployment Script
 * @description Deploys KeyRegistry and PatientRecordsFactory contracts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function main() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Deploying Smart Contracts...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    const [deployer] = await hardhat_1.ethers.getSigners();
    console.log('🔑 Deploying with account:', deployer.address);
    console.log('💰 Account balance:', hardhat_1.ethers.utils.formatEther(await deployer.getBalance()), 'ETH\n');
    // Deploy KeyRegistry
    console.log('1️⃣  Deploying KeyRegistry...');
    const KeyRegistry = await hardhat_1.ethers.getContractFactory('KeyRegistry');
    const keyRegistry = await KeyRegistry.deploy();
    await keyRegistry.deployed();
    console.log('✅ KeyRegistry deployed to:', keyRegistry.address);
    console.log('   Transaction hash:', keyRegistry.deployTransaction.hash);
    console.log('   Gas used:', (await keyRegistry.deployTransaction.wait()).gasUsed.toString(), '\n');
    // Deploy PatientRecordsFactory
    console.log('2️⃣  Deploying PatientRecordsFactory...');
    const PatientRecordsFactory = await hardhat_1.ethers.getContractFactory('PatientRecordsFactory');
    const factory = await PatientRecordsFactory.deploy();
    await factory.deployed();
    console.log('✅ PatientRecordsFactory deployed to:', factory.address);
    console.log('   Transaction hash:', factory.deployTransaction.hash);
    console.log('   Gas used:', (await factory.deployTransaction.wait()).gasUsed.toString(), '\n');
    // Save deployment addresses
    const deploymentInfo = {
        network: (await hardhat_1.ethers.provider.getNetwork()).name,
        chainId: (await hardhat_1.ethers.provider.getNetwork()).chainId,
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
    const deploymentsDir = path_1.default.join(__dirname, '..', 'deployments');
    if (!fs_1.default.existsSync(deploymentsDir)) {
        fs_1.default.mkdirSync(deploymentsDir, { recursive: true });
    }
    // Save to file
    const filename = `deployment-${deploymentInfo.chainId}-${Date.now()}.json`;
    const filepath = path_1.default.join(deploymentsDir, filename);
    fs_1.default.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    // Also save as latest
    const latestFilepath = path_1.default.join(deploymentsDir, 'latest.json');
    fs_1.default.writeFileSync(latestFilepath, JSON.stringify(deploymentInfo, null, 2));
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
//# sourceMappingURL=deploy.js.map