// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./KeyRegistry.sol";

/**
 * @title PatientHealthRecords
 * @dev One contract per patient for managing health records with ECIES encryption and EIP-712 signatures
 * @notice Implements permission-based access control with off-chain storage pointers
 */
contract PatientHealthRecords is EIP712 {
    using ECDSA for bytes32;

    address public immutable patient;
    KeyRegistry public immutable keyRegistry;

    struct HealthRecord {
        uint256 recordId;
        string storagePointer;    // IPFS CID or S3 URL
        bytes32 contentDigest;    // SHA-256 hash of encrypted blob
        uint256 timestamp;
        uint256 lastUpdated;
        bool exists;
    }

    struct Permission {
        uint256 permissionId;
        address grantedTo;
        uint256[] recordIds;      // Can grant access to multiple records
        bytes wrappedKey;         // AES key encrypted with grantee's ECIES public key
        uint256 expirationTime;
        uint256 grantedAt;
        bool isRevoked;
    }

    struct EmergencyAccess {
        bytes32 emergencyId;
        address physician1;
        address physician2;
        uint256[] recordIds;
        uint256 justificationCode;  // Enum: 1=Trauma, 2=Unconscious, 3=Critical
        bytes wrappedKey;
        uint256 expirationTime;
        bool isActive;
        bool isConfirmed;
        uint256 confirmedAt;
    }

    // Storage
    mapping(uint256 => HealthRecord) private records;
    mapping(uint256 => Permission) private permissions;
    mapping(bytes32 => EmergencyAccess) private emergencyAccess;
    mapping(bytes32 => bool) private usedNonces;  // Replay protection
    mapping(address => uint256[]) private userPermissions;  // Quick lookup

    uint256 private recordCount;
    uint256 private permissionCount;

    // Optional access logging
    bool public accessLoggingEnabled;
    mapping(uint256 => AccessLog[]) private accessLogs;

    struct AccessLog {
        address accessor;
        uint256 timestamp;
        bytes32 detailsHash;
    }

    // EIP-712 Type Hashes
    bytes32 private constant GRANT_PERMISSION_TYPEHASH =
        keccak256(
            "GrantPermission(address grantedTo,uint256[] recordIds,bytes wrappedKey,uint256 expirationTime,uint256 nonce)"
        );

    bytes32 private constant REVOKE_PERMISSION_TYPEHASH =
        keccak256("RevokePermission(uint256 permissionId,uint256 nonce)");

    // Events
    event RecordAdded(uint256 indexed recordId, string storagePointer, bytes32 contentDigest, uint256 timestamp);
    event RecordUpdated(uint256 indexed recordId, string newStoragePointer, bytes32 newContentDigest, uint256 timestamp);
    event PermissionGranted(uint256 indexed permissionId, address indexed grantedTo, uint256[] recordIds, uint256 expirationTime);
    event PermissionRevoked(uint256 indexed permissionId, address indexed grantedTo);
    event EmergencyAccessRequested(bytes32 indexed emergencyId, address indexed physician1, address indexed physician2, uint256 justificationCode);
    event EmergencyAccessConfirmed(bytes32 indexed emergencyId, uint256 confirmedAt);
    event AccessLogged(uint256 indexed recordId, address indexed accessor, uint256 timestamp);

    // Modifiers
    modifier onlyPatient() {
        require(msg.sender == patient, "Only patient can perform this action");
        _;
    }

    modifier recordExists(uint256 _recordId) {
        require(records[_recordId].exists, "Record does not exist");
        _;
    }

    /**
     * @dev Constructor
     * @param _patient The patient's address (owner of this contract)
     * @param _keyRegistry Address of the KeyRegistry contract
     * @param _accessLoggingEnabled Whether to enable access logging
     */
    constructor(
        address _patient,
        address _keyRegistry,
        bool _accessLoggingEnabled
    ) EIP712("PatientHealthRecords", "1") {
        require(_patient != address(0), "Invalid patient address");
        require(_keyRegistry != address(0), "Invalid KeyRegistry address");

        patient = _patient;
        keyRegistry = KeyRegistry(_keyRegistry);
        accessLoggingEnabled = _accessLoggingEnabled;
    }

    /**
     * @dev Add a new health record
     * @param _storagePointer IPFS CID or S3 URL of encrypted record
     * @param _contentDigest SHA-256 hash of the encrypted blob
     */
    function addRecord(string memory _storagePointer, bytes32 _contentDigest)
        external
        onlyPatient
        returns (uint256)
    {
        require(bytes(_storagePointer).length > 0, "Storage pointer cannot be empty");
        require(_contentDigest != bytes32(0), "Content digest cannot be empty");

        uint256 recordId = recordCount++;

        records[recordId] = HealthRecord({
            recordId: recordId,
            storagePointer: _storagePointer,
            contentDigest: _contentDigest,
            timestamp: block.timestamp,
            lastUpdated: block.timestamp,
            exists: true
        });

        emit RecordAdded(recordId, _storagePointer, _contentDigest, block.timestamp);

        return recordId;
    }

    /**
     * @dev Update an existing record (key rotation scenario)
     * @param _recordId The record ID to update
     * @param _newStoragePointer New storage pointer (re-encrypted with new key)
     * @param _newContentDigest New content digest
     */
    function updateRecord(
        uint256 _recordId,
        string memory _newStoragePointer,
        bytes32 _newContentDigest
    ) external onlyPatient recordExists(_recordId) {
        require(bytes(_newStoragePointer).length > 0, "Storage pointer cannot be empty");
        require(_newContentDigest != bytes32(0), "Content digest cannot be empty");

        records[_recordId].storagePointer = _newStoragePointer;
        records[_recordId].contentDigest = _newContentDigest;
        records[_recordId].lastUpdated = block.timestamp;

        emit RecordUpdated(_recordId, _newStoragePointer, _newContentDigest, block.timestamp);
    }

    /**
     * @dev Grant permission via EIP-712 signature (off-chain signing)
     * @param _grantedTo Address receiving permission
     * @param _recordIds Array of record IDs to grant access to
     * @param _wrappedKey AES key encrypted with grantee's ECIES public key
     * @param _expirationTime Unix timestamp when permission expires
     * @param _nonce Unique nonce to prevent replay attacks
     * @param _signature Patient's EIP-712 signature
     */
    function grantPermissionBySig(
        address _grantedTo,
        uint256[] memory _recordIds,
        bytes memory _wrappedKey,
        uint256 _expirationTime,
        uint256 _nonce,
        bytes memory _signature
    ) external returns (uint256) {
        require(_grantedTo != address(0), "Invalid grantee address");
        require(_recordIds.length > 0, "Must grant access to at least one record");
        require(_expirationTime > block.timestamp, "Expiration must be in the future");
        require(_wrappedKey.length > 0, "Wrapped key cannot be empty");

        // Check nonce hasn't been used (replay protection)
        bytes32 nonceHash = keccak256(abi.encodePacked(_nonce));
        require(!usedNonces[nonceHash], "Nonce already used");

        // Verify grantee has registered public key
        require(keyRegistry.hasActiveKey(_grantedTo), "Grantee must have registered public key");

        // Verify all records exist
        for (uint256 i = 0; i < _recordIds.length; i++) {
            require(records[_recordIds[i]].exists, "Record does not exist");
        }

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                GRANT_PERMISSION_TYPEHASH,
                _grantedTo,
                keccak256(abi.encodePacked(_recordIds)),
                keccak256(_wrappedKey),
                _expirationTime,
                _nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(_signature);

        require(signer == patient, "Invalid signature");

        // Mark nonce as used
        usedNonces[nonceHash] = true;

        // Create permission
        uint256 permissionId = permissionCount++;

        permissions[permissionId] = Permission({
            permissionId: permissionId,
            grantedTo: _grantedTo,
            recordIds: _recordIds,
            wrappedKey: _wrappedKey,
            expirationTime: _expirationTime,
            grantedAt: block.timestamp,
            isRevoked: false
        });

        userPermissions[_grantedTo].push(permissionId);

        emit PermissionGranted(permissionId, _grantedTo, _recordIds, _expirationTime);

        return permissionId;
    }

    /**
     * @dev Grant permission directly (on-chain call by patient)
     * @param _grantedTo Address receiving permission
     * @param _recordIds Array of record IDs
     * @param _wrappedKey Encrypted AES key
     * @param _expirationTime Expiration timestamp
     */
    function grantPermission(
        address _grantedTo,
        uint256[] memory _recordIds,
        bytes memory _wrappedKey,
        uint256 _expirationTime
    ) external onlyPatient returns (uint256) {
        require(_grantedTo != address(0), "Invalid grantee address");
        require(_recordIds.length > 0, "Must grant access to at least one record");
        require(_expirationTime > block.timestamp, "Expiration must be in the future");
        require(_wrappedKey.length > 0, "Wrapped key cannot be empty");
        require(keyRegistry.hasActiveKey(_grantedTo), "Grantee must have registered public key");

        for (uint256 i = 0; i < _recordIds.length; i++) {
            require(records[_recordIds[i]].exists, "Record does not exist");
        }

        uint256 permissionId = permissionCount++;

        permissions[permissionId] = Permission({
            permissionId: permissionId,
            grantedTo: _grantedTo,
            recordIds: _recordIds,
            wrappedKey: _wrappedKey,
            expirationTime: _expirationTime,
            grantedAt: block.timestamp,
            isRevoked: false
        });

        userPermissions[_grantedTo].push(permissionId);

        emit PermissionGranted(permissionId, _grantedTo, _recordIds, _expirationTime);

        return permissionId;
    }

    /**
     * @dev Revoke a permission
     * @param _permissionId The permission ID to revoke
     */
    function revokePermission(uint256 _permissionId) external onlyPatient {
        require(permissions[_permissionId].grantedTo != address(0), "Permission does not exist");
        require(!permissions[_permissionId].isRevoked, "Permission already revoked");

        permissions[_permissionId].isRevoked = true;

        emit PermissionRevoked(_permissionId, permissions[_permissionId].grantedTo);
    }

    /**
     * @dev Request emergency access (requires two physicians)
     * @param _physician1 First physician address
     * @param _physician2 Second physician address
     * @param _recordIds Array of record IDs needed for emergency
     * @param _justificationCode Emergency justification (1=Trauma, 2=Unconscious, 3=Critical)
     * @param _wrappedKey Emergency access key
     */
    function requestEmergencyAccess(
        address _physician1,
        address _physician2,
        uint256[] memory _recordIds,
        uint256 _justificationCode,
        bytes memory _wrappedKey
    ) external returns (bytes32) {
        require(_physician1 != address(0) && _physician2 != address(0), "Invalid physician addresses");
        require(_physician1 != _physician2, "Physicians must be different");
        require(_recordIds.length > 0, "Must request access to at least one record");
        require(_justificationCode >= 1 && _justificationCode <= 3, "Invalid justification code");
        require(
            msg.sender == _physician1 || msg.sender == _physician2,
            "Only one of the physicians can request"
        );

        bytes32 emergencyId = keccak256(
            abi.encodePacked(_physician1, _physician2, _recordIds, block.timestamp)
        );

        uint256 expirationTime = block.timestamp + 1 hours;  // 1 hour emergency access

        emergencyAccess[emergencyId] = EmergencyAccess({
            emergencyId: emergencyId,
            physician1: _physician1,
            physician2: _physician2,
            recordIds: _recordIds,
            justificationCode: _justificationCode,
            wrappedKey: _wrappedKey,
            expirationTime: expirationTime,
            isActive: false,
            isConfirmed: false,
            confirmedAt: 0
        });

        emit EmergencyAccessRequested(emergencyId, _physician1, _physician2, _justificationCode);

        return emergencyId;
    }

    /**
     * @dev Confirm emergency access (second physician confirms)
     * @param _emergencyId The emergency access ID
     */
    function confirmEmergencyAccess(bytes32 _emergencyId) external {
        EmergencyAccess storage emergency = emergencyAccess[_emergencyId];

        require(emergency.physician1 != address(0), "Emergency access does not exist");
        require(!emergency.isConfirmed, "Already confirmed");
        require(block.timestamp < emergency.expirationTime, "Emergency access expired");
        require(
            msg.sender == emergency.physician1 || msg.sender == emergency.physician2,
            "Only designated physicians can confirm"
        );

        emergency.isConfirmed = true;
        emergency.isActive = true;
        emergency.confirmedAt = block.timestamp;

        emit EmergencyAccessConfirmed(_emergencyId, block.timestamp);
    }

    /**
     * @dev Check if a user has access to a specific record
     * @param _user The user's address
     * @param _recordId The record ID
     * @return hasAccess Whether the user has access
     * @return wrappedKey The wrapped decryption key
     */
    function checkAccess(address _user, uint256 _recordId)
        external
        view
        recordExists(_recordId)
        returns (bool hasAccess, bytes memory wrappedKey)
    {
        // Patient always has access
        if (_user == patient) {
            return (true, "");
        }

        // Check regular permissions
        uint256[] memory userPerms = userPermissions[_user];
        for (uint256 i = 0; i < userPerms.length; i++) {
            Permission memory perm = permissions[userPerms[i]];

            if (!perm.isRevoked && block.timestamp < perm.expirationTime) {
                for (uint256 j = 0; j < perm.recordIds.length; j++) {
                    if (perm.recordIds[j] == _recordId) {
                        return (true, perm.wrappedKey);
                    }
                }
            }
        }

        return (false, "");
    }

    /**
     * @dev Log record access (optional feature)
     * @param _recordId The record being accessed
     * @param _detailsHash Hash of access details
     */
    function logAccess(uint256 _recordId, bytes32 _detailsHash)
        external
        recordExists(_recordId)
    {
        require(accessLoggingEnabled, "Access logging not enabled");

        (bool hasAccess, ) = this.checkAccess(msg.sender, _recordId);
        require(hasAccess, "No access to this record");

        accessLogs[_recordId].push(AccessLog({
            accessor: msg.sender,
            timestamp: block.timestamp,
            detailsHash: _detailsHash
        }));

        emit AccessLogged(_recordId, msg.sender, block.timestamp);
    }

    /**
     * @dev Get record metadata
     * @param _recordId The record ID
     * @return storagePointer Storage location
     * @return contentDigest Content hash
     * @return timestamp Creation time
     * @return lastUpdated Last update time
     */
    function getRecordMetadata(uint256 _recordId)
        external
        view
        recordExists(_recordId)
        returns (
            string memory storagePointer,
            bytes32 contentDigest,
            uint256 timestamp,
            uint256 lastUpdated
        )
    {
        (bool hasAccess, ) = this.checkAccess(msg.sender, _recordId);
        require(hasAccess, "No access to this record");

        HealthRecord memory record = records[_recordId];
        return (record.storagePointer, record.contentDigest, record.timestamp, record.lastUpdated);
    }

    /**
     * @dev Get all record IDs for the patient
     * @return Array of record IDs
     */
    function getAllRecordIds() external view returns (uint256[] memory) {
        uint256[] memory recordIds = new uint256[](recordCount);
        for (uint256 i = 0; i < recordCount; i++) {
            recordIds[i] = i;
        }
        return recordIds;
    }

    /**
     * @dev Get records accessible by a user
     * @param _user The user's address
     * @return Array of record IDs
     */
    function getAccessibleRecords(address _user) external view returns (uint256[] memory) {
        if (_user == patient) {
            return this.getAllRecordIds();
        }

        uint256[] memory tempRecords = new uint256[](recordCount);
        uint256 count = 0;

        uint256[] memory userPerms = userPermissions[_user];
        for (uint256 i = 0; i < userPerms.length; i++) {
            Permission memory perm = permissions[userPerms[i]];

            if (!perm.isRevoked && block.timestamp < perm.expirationTime) {
                for (uint256 j = 0; j < perm.recordIds.length; j++) {
                    tempRecords[count++] = perm.recordIds[j];
                }
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempRecords[i];
        }

        return result;
    }

    /**
     * @dev Get access logs for a record
     * @param _recordId The record ID
     * @return accessors Array of accessor addresses
     * @return timestamps Array of access timestamps
     */
    function getAccessLogs(uint256 _recordId)
        external
        view
        recordExists(_recordId)
        returns (address[] memory accessors, uint256[] memory timestamps)
    {
        require(msg.sender == patient, "Only patient can view access logs");
        require(accessLoggingEnabled, "Access logging not enabled");

        AccessLog[] memory logs = accessLogs[_recordId];
        accessors = new address[](logs.length);
        timestamps = new uint256[](logs.length);

        for (uint256 i = 0; i < logs.length; i++) {
            accessors[i] = logs[i].accessor;
            timestamps[i] = logs[i].timestamp;
        }

        return (accessors, timestamps);
    }

    /**
     * @dev Get total number of records
     * @return The record count
     */
    function getRecordCount() external view returns (uint256) {
        return recordCount;
    }

    /**
     * @dev Get EIP-712 domain separator
     * @return The domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
