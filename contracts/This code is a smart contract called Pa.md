This code is a smart contract called "PatientRecords" that allows a patient to store their medical records on a blockchain network using the ERC721 token standard. The smart contract has the following functionality:

- Inherits four contracts named ERC721, ERC721URIStorage, ERC721Enumerable, and Ownable.
- Initializes a state variable "patient" (an Ethereum address) in the constructor, which represents the address of the patient who owns the medical records.
- Defines a struct named "Permission" that represents the permission granted to a third party to access specific medical records.
- Declares a mapping "permissions" that stores the permission object based on its permission ID. It also declares a counter "_permissionIds" to increment the permission ID.
- Defines a function called "addRecord" that allows the patient to add a new medical record to their account. The function creates a new ERC721 token with a unique ID, stores the IPFS hash of the record and the encrypted key in the token metadata, and mints the token to the patient.
- Defines a function called "grantPermission" that allows the patient to grant permission to a third party to access a specific medical record. The function creates a new permission object and stores it in the "permissions" mapping based on the permission ID.
- Defines a function called "revokePermission" that allows the patient to revoke permission from a third party.
- Defines a function called "hasValidPermission" that checks if a third party has valid permission to access a specific medical record.
- Implements the required ERC721 functions, including "tokenURI" for metadata, and overrides ERC721, ERC721URIStorage, and ERC721Enumerable functions "supportsInterface", "burn", and "beforeTokenTransfer", respectively.
