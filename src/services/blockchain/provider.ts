/**
 * @file Blockchain Provider Service
 * @description Manages blockchain connection and provider instance
 */

import { providers, Wallet } from 'ethers';
import config from '../../config';

let providerInstance: providers.JsonRpcProvider | null = null;

/**
 * Get blockchain provider instance (singleton)
 */
export function getProvider(): providers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = new providers.JsonRpcProvider(config.blockchain.rpcUrl);
  }
  return providerInstance;
}

/**
 * Create a wallet instance from private key
 */
export function createWallet(privateKey: string): Wallet {
  const provider = getProvider();
  return new Wallet(privateKey, provider);
}

/**
 * Get network information
 */
export async function getNetworkInfo(): Promise<{
  chainId: number;
  name: string;
}> {
  const provider = getProvider();
  const network = await provider.getNetwork();

  return {
    chainId: network.chainId,
    name: network.name,
  };
}

/**
 * Get current block number
 */
export async function getBlockNumber(): Promise<number> {
  const provider = getProvider();
  return await provider.getBlockNumber();
}

/**
 * Get gas price
 */
export async function getGasPrice(): Promise<any> {
  const provider = getProvider();
  return await provider.getGasPrice();
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  txHash: string,
  confirmations: number = 1
): Promise<any> {
  const provider = getProvider();
  return await provider.waitForTransaction(txHash, confirmations);
}
