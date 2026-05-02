import { generateE2EEKeys, exportPublicKey, importPublicKey, encryptForBoth, decryptMessage, isEncryptedPayload } from '../shared/lib/cryptoUtils';

/**
 * Mocking Web Crypto API and Text Encoding for Node.js environment (Jest/JSDOM)
 */
const crypto = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

if (typeof window !== 'undefined') {
  if (!window.crypto) {
    Object.defineProperty(window, 'crypto', {
      value: crypto.webcrypto,
      writable: true
    });
  }
  if (!window.TextEncoder) {
    Object.defineProperty(window, 'TextEncoder', {
      value: TextEncoder,
      writable: true
    });
  }
  if (!window.TextDecoder) {
    Object.defineProperty(window, 'TextDecoder', {
      value: TextDecoder,
      writable: true
    });
  }
}

describe('CryptoUtils End-to-End Encryption', () => {
  let senderKeys: CryptoKeyPair;
  let recipientKeys: CryptoKeyPair;
  let senderPubPem: string;
  let recipientPubPem: string;

  beforeAll(async () => {
    senderKeys = await generateE2EEKeys();
    recipientKeys = await generateE2EEKeys();
    
    senderPubPem = await exportPublicKey(senderKeys.publicKey);
    recipientPubPem = await exportPublicKey(recipientKeys.publicKey);
  });

  test('should generate valid RSA keys', () => {
    expect(senderKeys.publicKey.type).toBe('public');
    expect(senderKeys.privateKey.type).toBe('private');
  });

  test('should encrypt a message for both parties', async () => {
    const plainText = 'Hello, this is a secure message!';
    const encrypted = await encryptForBoth(plainText, recipientPubPem, senderPubPem);
    
    expect(isEncryptedPayload(encrypted)).toBe(true);
    const parsed = JSON.parse(encrypted);
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('s'); 
    expect(parsed).toHaveProperty('r'); 
    expect(parsed).toHaveProperty('c'); 
  });

  test('should decrypt message as recipient', async () => {
    const plainText = 'Secure communication test';
    const encrypted = await encryptForBoth(plainText, recipientPubPem, senderPubPem);
    
    const decrypted = await decryptMessage(encrypted, recipientKeys.privateKey, false);
    expect(decrypted).toBe(plainText);
  });

  test('should decrypt message as sender', async () => {
    const plainText = 'Sender decryption test';
    const encrypted = await encryptForBoth(plainText, recipientPubPem, senderPubPem);
    
    const decrypted = await decryptMessage(encrypted, senderKeys.privateKey, true);
    expect(decrypted).toBe(plainText);
  });

  test('should identify encrypted payloads correctly', () => {
    const validPayload = JSON.stringify({ iv: 'abc', r: 'def', c: 'ghi' });
    const invalidPayload = 'just a normal string';
    const incompletePayload = JSON.stringify({ iv: 'abc' });

    expect(isEncryptedPayload(validPayload)).toBe(true);
    expect(isEncryptedPayload(invalidPayload)).toBe(false);
    expect(isEncryptedPayload(incompletePayload)).toBe(false);
  });
});
