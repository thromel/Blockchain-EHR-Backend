// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KeyRegistry
 * @dev Manages public keys for all participants in the healthcare system
 * @notice Stores secp256k1 public keys on-chain for ECIES encryption
 */
contract KeyRegistry {
    struct PublicKey {
        bytes publicKey;      // 65 bytes uncompressed secp256k1 public key (0x04 + 32 bytes X + 32 bytes Y)
        uint256 timestamp;    // Registration timestamp
        uint256 version;      // Key version for rotation support
        bool isActive;        // Active status
    }

    // Address => Key Version => Public Key
    mapping(address => mapping(uint256 => PublicKey)) private keys;

    // Address => Current active version
    mapping(address => uint256) private currentVersion;

    // Address => Registration status
    mapping(address => bool) public isRegistered;

    // Events
    event KeyRegistered(
        address indexed user,
        uint256 indexed version,
        bytes publicKey,
        uint256 timestamp
    );

    event KeyRotated(
        address indexed user,
        uint256 indexed oldVersion,
        uint256 indexed newVersion,
        uint256 timestamp
    );

    event KeyRevoked(
        address indexed user,
        uint256 indexed version,
        uint256 timestamp
    );

    /**
     * @dev Register a new public key for the sender
     * @param _publicKey The uncompressed secp256k1 public key (65 bytes)
     */
    function registerKey(bytes memory _publicKey) external {
        require(_publicKey.length == 65, "Invalid public key length");
        require(_publicKey[0] == 0x04, "Public key must be uncompressed");
        require(!isRegistered[msg.sender], "Key already registered. Use rotateKey instead");

        uint256 version = 0;
        keys[msg.sender][version] = PublicKey({
            publicKey: _publicKey,
            timestamp: block.timestamp,
            version: version,
            isActive: true
        });

        currentVersion[msg.sender] = version;
        isRegistered[msg.sender] = true;

        emit KeyRegistered(msg.sender, version, _publicKey, block.timestamp);
    }

    /**
     * @dev Rotate to a new public key (key rotation)
     * @param _newPublicKey The new uncompressed secp256k1 public key (65 bytes)
     */
    function rotateKey(bytes memory _newPublicKey) external {
        require(_newPublicKey.length == 65, "Invalid public key length");
        require(_newPublicKey[0] == 0x04, "Public key must be uncompressed");
        require(isRegistered[msg.sender], "No key registered. Use registerKey first");

        uint256 oldVersion = currentVersion[msg.sender];
        uint256 newVersion = oldVersion + 1;

        // Deactivate old key
        keys[msg.sender][oldVersion].isActive = false;

        // Register new key
        keys[msg.sender][newVersion] = PublicKey({
            publicKey: _newPublicKey,
            timestamp: block.timestamp,
            version: newVersion,
            isActive: true
        });

        currentVersion[msg.sender] = newVersion;

        emit KeyRotated(msg.sender, oldVersion, newVersion, block.timestamp);
    }

    /**
     * @dev Revoke the current active key
     */
    function revokeKey() external {
        require(isRegistered[msg.sender], "No key registered");

        uint256 version = currentVersion[msg.sender];
        require(keys[msg.sender][version].isActive, "Key already revoked");

        keys[msg.sender][version].isActive = false;

        emit KeyRevoked(msg.sender, version, block.timestamp);
    }

    /**
     * @dev Get the current active public key for a user
     * @param _user The user's address
     * @return publicKey The current public key
     * @return version The key version
     * @return timestamp Registration timestamp
     */
    function getPublicKey(address _user)
        external
        view
        returns (
            bytes memory publicKey,
            uint256 version,
            uint256 timestamp
        )
    {
        require(isRegistered[_user], "User not registered");

        version = currentVersion[_user];
        PublicKey memory key = keys[_user][version];

        require(key.isActive, "Key has been revoked");

        return (key.publicKey, key.version, key.timestamp);
    }

    /**
     * @dev Get a specific version of a user's public key
     * @param _user The user's address
     * @param _version The key version
     * @return publicKey The public key
     * @return timestamp Registration timestamp
     * @return isActive Whether the key is active
     */
    function getPublicKeyByVersion(address _user, uint256 _version)
        external
        view
        returns (
            bytes memory publicKey,
            uint256 timestamp,
            bool isActive
        )
    {
        require(isRegistered[_user], "User not registered");
        require(_version <= currentVersion[_user], "Invalid version");

        PublicKey memory key = keys[_user][_version];
        return (key.publicKey, key.timestamp, key.isActive);
    }

    /**
     * @dev Get the current version number for a user
     * @param _user The user's address
     * @return The current key version
     */
    function getCurrentVersion(address _user) external view returns (uint256) {
        require(isRegistered[_user], "User not registered");
        return currentVersion[_user];
    }

    /**
     * @dev Check if a user has an active key
     * @param _user The user's address
     * @return True if user has an active key
     */
    function hasActiveKey(address _user) external view returns (bool) {
        if (!isRegistered[_user]) {
            return false;
        }

        uint256 version = currentVersion[_user];
        return keys[_user][version].isActive;
    }

    /**
     * @dev Batch get public keys for multiple users
     * @param _users Array of user addresses
     * @return publicKeys Array of public keys
     * @return versions Array of versions
     */
    function getBatchPublicKeys(address[] calldata _users)
        external
        view
        returns (
            bytes[] memory publicKeys,
            uint256[] memory versions
        )
    {
        publicKeys = new bytes[](_users.length);
        versions = new uint256[](_users.length);

        for (uint256 i = 0; i < _users.length; i++) {
            if (isRegistered[_users[i]]) {
                uint256 version = currentVersion[_users[i]];
                PublicKey memory key = keys[_users[i]][version];

                if (key.isActive) {
                    publicKeys[i] = key.publicKey;
                    versions[i] = version;
                }
            }
        }

        return (publicKeys, versions);
    }
}
