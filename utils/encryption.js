const crypto = require('crypto');

// Generate a random symmetric encryption key
function generateSymmetricKey() {
  return crypto.randomBytes(32);
}

// Encrypt data using the symmetric encryption key
function encryptData(symmKey, data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', symmKey, iv);
  const encryptedData = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  return { iv, encryptedData };
}

// Decrypt data using the symmetric encryption key
function decryptData(symmKey, iv, encryptedData) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', symmKey, iv);
  const decryptedData = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
  return decryptedData.toString('utf8');
}

const forge = require('node-forge');

async function encryptWithPublicKey(publicKeyPem, data) {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const symmKey = forge.random.getBytesSync(32);
  const encryptedData = forge.util.encode64(
    publicKey.encrypt(data, 'RSA-OAEP')
  );

  const encryptedSymmKey = publicKey.encrypt(symmKey, 'RSA-OAEP');
  const encryptedSymmKeyBase64 = forge.util.encode64(encryptedSymmKey);

  return { encryptedData, encryptedSymmKey: encryptedSymmKeyBase64 };
}

async function decryptWithPrivateKey(
  privateKeyPem,
  encryptedData,
  encryptedSymmKeyBase64
) {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const encryptedSymmKey = forge.util.decode64(encryptedSymmKeyBase64);
  const symmKey = privateKey.decrypt(encryptedSymmKey, 'RSA-OAEP');

  const decryptedData = privateKey.decrypt(
    forge.util.decode64(encryptedData),
    'RSA-OAEP'
  );
  return decryptedData;
}

module.exports = { encryptWithPublicKey, decryptWithPrivateKey };

module.exports = {
  encryptWithPublicKey,
  decryptWithPrivateKey,
  decryptData,
};
