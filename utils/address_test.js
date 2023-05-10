const { ethers } = require('hardhat');

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    'http://127.0.0.1:8545'
  );
  const address = '0xB7A5bd0345EF1Cc5E66bf61BdeC17D2461fBd968'; // Replace with the address you want to check

  // Check if the address is valid
  if (ethers.utils.isAddress(address)) {
    console.log('Address is valid.');

    // Check if there's contract code at the given address
    const code = await provider.getCode(address);

    // console.log(code);

    if (code === '0x') {
      console.log('No contract deployed at this address.');
    } else {
      console.log('Contract deployed at this address.');
    }
  } else {
    console.log('Address is not valid.');
  }
}

main();
