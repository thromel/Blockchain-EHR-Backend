// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "./PatientRecords.sol";

contract PatientRecordFactory {
    mapping(address => address) public patientRecords;

    // Event to notify when a new PatientRecords contract is created
    event PatientRecordsCreated(address patientRecords);

    // Function to deploy a new PatientRecords contract
    function createPatientRecords(address patient) public returns (address) {
        require(patientRecords[patient] == address(0), "PatientRecord already exists for the user.");
        
        PatientRecords newPatientRecord = new PatientRecords(patient);
        patientRecords[patient] = address(newPatientRecord);
        emit PatientRecordsCreated(address(newPatientRecord));
        return address(newPatientRecord);
    }

    function getPatientRecordByUser(address user) public view returns (address) {
        return patientRecords[user];
    }
}
