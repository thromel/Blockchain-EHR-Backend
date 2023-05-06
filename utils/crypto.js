// utils/crypto.js
const crypto = require('crypto');

function encryptSymmetric(data, key) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
  let encryptedData = cipher.update(data, 'utf8', 'base64');
  encryptedData += cipher.final('base64');
  return encryptedData;
}

function decryptSymmetric(encryptedData, key) {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    Buffer.alloc(16, 0)
  );
  let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
  decryptedData += decipher.final('utf8');
  return decryptedData;
}

module.exports = { encryptSymmetric, decryptSymmetric };
