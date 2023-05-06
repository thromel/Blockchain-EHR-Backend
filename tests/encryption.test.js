const encryption = require('../utils/encryption');
const forge = require('node-forge');

describe('Encryption and Decryption', () => {
  let keyPair;

  beforeAll(() => {
    keyPair = forge.pki.rsa.generateKeyPair(2048);
  });

  it('should encrypt and decrypt the data correctly', async () => {
    const data = 'This is a test message.';
    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);
    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);

    const { encryptedData, encryptedSymmKey } =
      await encryption.encryptWithPublicKey(publicKeyPem, data);
    const decryptedData = await encryption.decryptWithPrivateKey(
      privateKeyPem,
      encryptedData,
      encryptedSymmKey
    );

    expect(decryptedData).toEqual(data);
  });
});
