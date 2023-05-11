// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PatientRecords is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    using ECDSA for bytes32;
    using Counters for Counters.Counter;

    address public patient;
    bytes32[] public records;
    Counters.Counter private _permissionIds;
    mapping(uint256 => Permission) public permissions;

    struct Permission {
        uint256 permissionId;
        uint256 recordId;
        address grantedTo;
        uint256 expirationTimestamp;
        bool isRevoked;
    }

    constructor(address _patient) ERC721("PatientRecords", "PR") {
        patient = _patient;
    }

    event RecordAdded(uint256 recordIndex);
    

    // Adding a new record for the patient
    function addRecord(
        bytes32 recordHash,
        bytes memory encryptedKey,
        bytes memory signature
    ) public {
        // Verify the signature
        bytes32 hash = keccak256(abi.encodePacked("Add record"));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        address signer = messageHash.recover(signature);

        // Only allow the patient to add records
        require(signer == patient, "Only the patient can add records.");

        uint256 tokenId = totalSupply();
        _safeMint(patient, tokenId);
        records.push(recordHash);
        _setTokenURI(tokenId, string(abi.encodePacked(recordHash)));
        _setTokenMetadata(tokenId, encryptedKey);

        uint256 recordIndex = records.length - 1;
        emit RecordAdded(recordIndex);
    }

    function getRecordByIndex(uint256 index) public view returns (uint256 tokenId, string memory recordURI, bytes memory recordMetadata, bytes32 recordHash) {
    // require(ownerOf(index) == msg.sender, "You don't own this record.");
        tokenId = index;
        recordURI = tokenURI(index);
        recordMetadata = tokenMetadata(index);
        recordHash = records[index];
    }


    


    // Granting permission to a third party to access a specific record
    function grantPermission(
        uint256 recordId,
        address grantedTo,
        uint256 expirationTimestamp
    ) public {
        require(
            msg.sender == patient,
            "Only the patient can grant permissions."
        );
        require(grantedTo != patient, "Cannot grant permission to self.");
        require(recordId < totalSupply(), "Invalid record ID.");
        _permissionIds.increment();
        uint256 permissionId = _permissionIds.current();
        permissions[permissionId] = Permission(
            permissionId,
            recordId,
            grantedTo,
            expirationTimestamp,
            false
        );
    }

    // Revoking permission from a third party
    function revokePermission(uint256 permissionId) public {
        require(
            msg.sender == patient,
            "Only the patient can revoke permissions."
        );
        require(
            permissions[permissionId].grantedTo != address(0),
            "Permission does not exist."
        );
        permissions[permissionId].isRevoked = true;
    }

    // Checking if a third party has valid permission for a specific record
    function hasValidPermission(
        uint256 permissionId,
        uint256 recordId,
        address requester
    ) public view returns (bool) {
        require(
            permissionId <= _permissionIds.current(),
            "Invalid permission ID."
        );
        Permission memory permission = permissions[permissionId];
        return (permission.recordId == recordId &&
            permission.grantedTo == requester &&
            !permission.isRevoked &&
            permission.expirationTimestamp >= block.timestamp);
    }
 
    // ERC721 Metadata
    mapping(uint256 => bytes) private _tokenMetadata;

    function tokenMetadata(
        uint256 tokenId
    ) public view virtual returns (bytes memory) {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        return _tokenMetadata[tokenId];
    }

    function _setTokenMetadata(
        uint256 tokenId,
        bytes memory metadata
    ) internal virtual {
        require(
            _exists(tokenId),
            "ERC721Metadata: Metadata set of nonexistent token"
        );
        _tokenMetadata[tokenId] = metadata;
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
