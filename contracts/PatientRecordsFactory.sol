// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PatientHealthRecords.sol";
import "./KeyRegistry.sol";

/**
 * @title PatientRecordsFactory
 * @dev Factory contract for deploying individual PatientHealthRecords contracts
 * @notice One contract per patient approach - maintains registry of all patient contracts
 */
contract PatientRecordsFactory {
    KeyRegistry public immutable keyRegistry;

    // Patient address => PatientHealthRecords contract address
    mapping(address => address) private patientContracts;

    // Track all deployed contracts
    address[] private allPatientContracts;

    // Reverse lookup: contract address => patient address
    mapping(address => address) private contractToPatient;

    // Track deployment status
    mapping(address => bool) private isDeployed;

    // Default access logging setting for new contracts
    bool public defaultAccessLogging;

    // Events
    event PatientContractDeployed(
        address indexed patient,
        address indexed contractAddress,
        uint256 timestamp
    );

    event AccessLoggingDefaultChanged(bool newDefault);

    /**
     * @dev Constructor
     * @param _keyRegistry Address of the KeyRegistry contract
     * @param _defaultAccessLogging Default setting for access logging
     */
    constructor(address _keyRegistry, bool _defaultAccessLogging) {
        require(_keyRegistry != address(0), "Invalid KeyRegistry address");
        keyRegistry = KeyRegistry(_keyRegistry);
        defaultAccessLogging = _defaultAccessLogging;
    }

    /**
     * @dev Deploy a new PatientHealthRecords contract for a patient
     * @param _patient The patient's address
     * @return contractAddress The address of the deployed contract
     */
    function createPatientContract(address _patient)
        external
        returns (address contractAddress)
    {
        require(_patient != address(0), "Invalid patient address");
        require(!isDeployed[_patient], "Patient contract already exists");
        require(
            keyRegistry.hasActiveKey(_patient),
            "Patient must register public key first"
        );

        // Deploy new PatientHealthRecords contract
        PatientHealthRecords newContract = new PatientHealthRecords(
            _patient,
            address(keyRegistry),
            defaultAccessLogging
        );

        contractAddress = address(newContract);

        // Register the contract
        patientContracts[_patient] = contractAddress;
        contractToPatient[contractAddress] = _patient;
        allPatientContracts.push(contractAddress);
        isDeployed[_patient] = true;

        emit PatientContractDeployed(_patient, contractAddress, block.timestamp);

        return contractAddress;
    }

    /**
     * @dev Deploy a contract with custom access logging setting
     * @param _patient The patient's address
     * @param _accessLogging Whether to enable access logging
     * @return contractAddress The address of the deployed contract
     */
    function createPatientContractWithLogging(
        address _patient,
        bool _accessLogging
    ) external returns (address contractAddress) {
        require(_patient != address(0), "Invalid patient address");
        require(!isDeployed[_patient], "Patient contract already exists");
        require(
            keyRegistry.hasActiveKey(_patient),
            "Patient must register public key first"
        );

        PatientHealthRecords newContract = new PatientHealthRecords(
            _patient,
            address(keyRegistry),
            _accessLogging
        );

        contractAddress = address(newContract);

        patientContracts[_patient] = contractAddress;
        contractToPatient[contractAddress] = _patient;
        allPatientContracts.push(contractAddress);
        isDeployed[_patient] = true;

        emit PatientContractDeployed(_patient, contractAddress, block.timestamp);

        return contractAddress;
    }

    /**
     * @dev Get the PatientHealthRecords contract address for a patient
     * @param _patient The patient's address
     * @return The contract address
     */
    function getPatientContract(address _patient)
        external
        view
        returns (address)
    {
        require(isDeployed[_patient], "No contract for this patient");
        return patientContracts[_patient];
    }

    /**
     * @dev Get the patient address for a contract
     * @param _contract The contract address
     * @return The patient's address
     */
    function getPatientFromContract(address _contract)
        external
        view
        returns (address)
    {
        address patient = contractToPatient[_contract];
        require(patient != address(0), "Contract not found");
        return patient;
    }

    /**
     * @dev Check if a patient has a deployed contract
     * @param _patient The patient's address
     * @return True if contract exists
     */
    function hasContract(address _patient) external view returns (bool) {
        return isDeployed[_patient];
    }

    /**
     * @dev Get total number of deployed patient contracts
     * @return The total count
     */
    function getTotalContracts() external view returns (uint256) {
        return allPatientContracts.length;
    }

    /**
     * @dev Get all deployed contract addresses (paginated)
     * @param _offset Start index
     * @param _limit Number of results to return
     * @return contracts Array of contract addresses
     * @return total Total number of contracts
     */
    function getAllContracts(uint256 _offset, uint256 _limit)
        external
        view
        returns (address[] memory contracts, uint256 total)
    {
        total = allPatientContracts.length;

        if (_offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - _offset;
        contracts = new address[](size);

        for (uint256 i = 0; i < size; i++) {
            contracts[i] = allPatientContracts[_offset + i];
        }

        return (contracts, total);
    }

    /**
     * @dev Get batch contract addresses for multiple patients
     * @param _patients Array of patient addresses
     * @return contracts Array of contract addresses (address(0) if not deployed)
     */
    function getBatchPatientContracts(address[] calldata _patients)
        external
        view
        returns (address[] memory contracts)
    {
        contracts = new address[](_patients.length);

        for (uint256 i = 0; i < _patients.length; i++) {
            if (isDeployed[_patients[i]]) {
                contracts[i] = patientContracts[_patients[i]];
            } else {
                contracts[i] = address(0);
            }
        }

        return contracts;
    }

    /**
     * @dev Set the default access logging setting for new contracts
     * @param _newDefault New default setting
     * @notice This only affects newly deployed contracts
     */
    function setDefaultAccessLogging(bool _newDefault) external {
        // In production, add access control (e.g., only owner)
        defaultAccessLogging = _newDefault;
        emit AccessLoggingDefaultChanged(_newDefault);
    }

    /**
     * @dev Get contract deployment info
     * @param _patient The patient's address
     * @return contractAddress The contract address
     * @return exists Whether contract exists
     * @return recordCount Number of records (if exists)
     */
    function getContractInfo(address _patient)
        external
        view
        returns (
            address contractAddress,
            bool exists,
            uint256 recordCount
        )
    {
        exists = isDeployed[_patient];
        contractAddress = patientContracts[_patient];

        if (exists) {
            PatientHealthRecords patientContract = PatientHealthRecords(contractAddress);
            recordCount = patientContract.getRecordCount();
        } else {
            recordCount = 0;
        }

        return (contractAddress, exists, recordCount);
    }
}
