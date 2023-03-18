// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "./PatientRecords.sol";

contract PatientRecordFactory {
    // Keep track of all deployed PatientRecords contracts
    address[] public patientRecordsInstances;

    // Event to notify when a new PatientRecords contract is created
    event PatientRecordsCreated(address patientRecords);

    // Function to deploy a new PatientRecords contract
    function createPatientRecords(address patient) public returns (address) {
        PatientRecords newPatientRecords = new PatientRecords(patient);
        patientRecordsInstances.push(address(newPatientRecords));
        emit PatientRecordsCreated(address(newPatientRecords));
        return address(newPatientRecords);
    }

    // Function to get all deployed PatientRecords contracts
    function getPatientRecordsInstances() public view returns (address[] memory) {
        return patientRecordsInstances;
    }
}
