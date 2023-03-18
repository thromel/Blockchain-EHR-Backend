# Patient Records - Hardhat Project
This project is a decentralized application (dApp) for managing patient records on the Ethereum blockchain. It uses Hardhat, a popular Ethereum development environment, and the PatientRecords smart contract based on the ERC721 standard.

## Features
* Decentralized storage of patient records
* Permission management for granting and revoking access to specific records
* Integration with ERC721 standard for compatibility with Ethereum wallets and marketplaces

## Prerequisites
Node.js v14.17.0 or later
npm or yarn
## Installation
- Clone the repository:

`git@github.com:BUET-UG-Thesis-Jan22-Blockchain-ASMLH/Backend.git`

- Change into the project directory:
``cd Backend``
- Install dependencies:
``npm install``

## Running Tests
To run the tests, execute the following command:

``npx hardhat test``

## Deployment
To deploy the PatientRecords smart contract to a local Hardhat network, run:

``npx hardhat run scripts/deploy.js --network localhost``

To deploy to a live network, such as the Ropsten testnet, first set up a .env file in the project root with your Infura API key and private key:

``INFURA_API_KEY=<YOUR_INFURA_API_KEY>
PRIVATE_KEY=<YOUR_PRIVATE_KEY>``
Then, run the following command:

``npx hardhat run scripts/deploy.js --network ropsten``