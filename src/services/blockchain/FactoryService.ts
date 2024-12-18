/**
 * @file Factory Service
 * @description Service for interacting with PatientRecordsFactory smart contract
 */

import { Contract, Wallet } from 'ethers';
import { getProvider } from './provider';
import config from '../../config';
import FactoryArtifact from '../../../artifacts/contracts/PatientRecordsFactory.sol/PatientRecordsFactory.json';

export class FactoryService {
  private contract: Contract;

  constructor(contractAddress?: string) {
    const provider = getProvider();
    const address = contractAddress || config.blockchain.factoryAddress;

    if (!address) {
      throw new Error('Factory contract address not configured');
    }

    this.contract = new Contract(address, FactoryArtifact.abi, provider);
  }

  /**
   * Create a new patient contract
   */
  async createPatientContract(wallet: Wallet, patientAddress: string): Promise<{
    contractAddress: string;
    transactionHash: string;
  }> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.createPatientContract(patientAddress);
      const receipt = await tx.wait();

      // Get the contract address from the event
      const event = receipt.events?.find((e: any) => e.event === 'PatientContractDeployed');
      const contractAddress = event?.args?.contractAddress;

      return {
        contractAddress,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(`Failed to create patient contract: ${(error as Error).message}`);
    }
  }

  /**
   * Create patient contract with custom access logging setting
   */
  async createPatientContractWithLogging(
    wallet: Wallet,
    patientAddress: string,
    accessLogging: boolean
  ): Promise<{
    contractAddress: string;
    transactionHash: string;
  }> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.createPatientContractWithLogging(
        patientAddress,
        accessLogging
      );
      const receipt = await tx.wait();

      const event = receipt.events?.find((e: any) => e.event === 'PatientContractDeployed');
      const contractAddress = event?.args?.contractAddress;

      return {
        contractAddress,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(`Failed to create patient contract with logging: ${(error as Error).message}`);
    }
  }

  /**
   * Get patient contract address
   */
  async getPatientContract(patientAddress: string): Promise<string> {
    try {
      return await this.contract.getPatientContract(patientAddress);
    } catch (error) {
      throw new Error(`Failed to get patient contract: ${(error as Error).message}`);
    }
  }

  /**
   * Get patient address from contract
   */
  async getPatientFromContract(contractAddress: string): Promise<string> {
    try {
      return await this.contract.getPatientFromContract(contractAddress);
    } catch (error) {
      throw new Error(`Failed to get patient from contract: ${(error as Error).message}`);
    }
  }

  /**
   * Check if patient has a contract
   */
  async hasContract(patientAddress: string): Promise<boolean> {
    try {
      return await this.contract.hasContract(patientAddress);
    } catch (error) {
      throw new Error(`Failed to check contract existence: ${(error as Error).message}`);
    }
  }

  /**
   * Get total number of contracts
   */
  async getTotalContracts(): Promise<number> {
    try {
      const total = await this.contract.getTotalContracts();
      return total.toNumber();
    } catch (error) {
      throw new Error(`Failed to get total contracts: ${(error as Error).message}`);
    }
  }

  /**
   * Get all contracts (paginated)
   */
  async getAllContracts(
    offset: number = 0,
    limit: number = 100
  ): Promise<{ contracts: string[]; total: number }> {
    try {
      const [contracts, total] = await this.contract.getAllContracts(offset, limit);

      return {
        contracts,
        total: total.toNumber(),
      };
    } catch (error) {
      throw new Error(`Failed to get all contracts: ${(error as Error).message}`);
    }
  }

  /**
   * Get batch contract addresses
   */
  async getBatchPatientContracts(patientAddresses: string[]): Promise<string[]> {
    try {
      return await this.contract.getBatchPatientContracts(patientAddresses);
    } catch (error) {
      throw new Error(`Failed to get batch contracts: ${(error as Error).message}`);
    }
  }

  /**
   * Get contract info
   */
  async getContractInfo(
    patientAddress: string
  ): Promise<{
    contractAddress: string;
    exists: boolean;
    recordCount: number;
  }> {
    try {
      const [contractAddress, exists, recordCount] = await this.contract.getContractInfo(
        patientAddress
      );

      return {
        contractAddress,
        exists,
        recordCount: recordCount.toNumber(),
      };
    } catch (error) {
      throw new Error(`Failed to get contract info: ${(error as Error).message}`);
    }
  }

  /**
   * Get contract address
   */
  getAddress(): string {
    return this.contract.address;
  }
}

// Export singleton instance
let factoryInstance: FactoryService | null = null;

export function getFactoryService(): FactoryService {
  if (!factoryInstance) {
    factoryInstance = new FactoryService();
  }
  return factoryInstance;
}
