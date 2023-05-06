To generate a unique permission token in a smart contract, you will need to use a cryptographic library or protocol such as the SHA-256 algorithm or the Elliptic Curve Digital Signature Algorithm (ECDSA).

Here is an example of how you might modify a smart contract to generate and verify a permission token:

```
pragma solidity ^0.8.0;

contract MyContract {
    mapping (address => bool) allowed;
    mapping (address => bytes32) permissionTokens;

    function givePermission(address user) public {
        require(msg.sender == owner, "Only owner can give permission");
        allowed[user] = true;
        permissionTokens[user] = sha256(abi.encodePacked(msg.sender, block.timestamp, user));
    }

    function removePermission(address user) public {
        require(msg.sender == owner, "Only owner can remove permission");
        allowed[user] = false;
        delete permissionTokens[user];
    }

    function verifyPermission(address user, bytes32 token) public view returns (bool) {
        return allowed[user] && permissionTokens[user] == token;
    }

    function doSomething() public {
        require(verifyPermission(msg.sender, permissionTokens[msg.sender]), "Permission token is invalid");
        // Do something
    }
}
```

In this example contract, the `givePermission` function generates a permission token for a given user by hashing a packed encoding of the contract owner's address, the current block timestamp, and the user's address. The `allowed` mapping is used to keep track of which users have permission to perform certain actions in the contract. The `permissionTokens` mapping stores each user's permission token for later verification.

The `verifyPermission` function can be used to check whether a given user has permission to perform a particular action. It checks that the user is allowed and that the permission token provided matches the one stored in the contract.

The `doSomething` function demonstrates how you might use the permission checking mechanism to enforce access control. When a user calls this function, their permission token is checked before the action is performed. If the permission token is invalid, the transaction will revert and the action will not be carried out.