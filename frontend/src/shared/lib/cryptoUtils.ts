/**
 * E2EE Crypto Utilities using Web Crypto API
 * Handles RSA key generation, AES-GCM encryption/decryption, and storage.
 */

const KEY_PAIR_ALGORITHM = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const DB_NAME = "FolioChatCrypto";
const STORE_NAME = "keys";

// --- IndexedDB Storage ---

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePrivateKey = async (privateKey: CryptoKey): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(privateKey, "privateKey");
};

export const getLocalPrivateKey = async (): Promise<CryptoKey | null> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  return new Promise((resolve) => {
    const request = tx.objectStore(STORE_NAME).get("privateKey");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
};

// --- Key Management ---

export const generateE2EEKeys = async (): Promise<CryptoKeyPair> => {
  return window.crypto.subtle.generateKey(KEY_PAIR_ALGORITHM, true, ["encrypt", "decrypt"]);
};

export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(exported))));
};

export const importPublicKey = async (pem: string): Promise<CryptoKey> => {
  const binary = atob(pem);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return window.crypto.subtle.importKey("spki", bytes.buffer, KEY_PAIR_ALGORITHM, true, ["encrypt"]);
};

// --- Encryption / Decryption ---

/**
 * Hybrid Encryption:
 * 1. Generates random AES-GCM key.
 * 2. Encrypts text with AES-GCM.
 * 3. Encrypts AES key with Recipient's RSA Public Key.
 * 4. Returns combined base64 string.
 */
export const encryptForRecipient = async (text: string, publicKeyPem: string): Promise<string> => {
  const publicKey = await importPublicKey(publicKeyPem);

  // 1. Generate random AES key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  // 2. Encrypt text with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedText
  );

  // 3. Encrypt AES key with RSA
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    exportedAesKey
  );

  // 4. Combine: IV(12) | EncryptedAESKey(256) | EncryptedContent
  const combined = new Uint8Array(12 + 256 + encryptedContent.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedAesKey), 12);
  combined.set(new Uint8Array(encryptedContent), 12 + 256);

  return btoa(String.fromCharCode(...Array.from(combined)));
};

export const decryptWithPrivateKey = async (base64Cipher: string, privateKey: CryptoKey): Promise<string> => {
  try {
    const binary = atob(base64Cipher);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);

    const iv = combined.slice(0, 12);
    const encryptedAesKey = combined.slice(12, 12 + 256);
    const encryptedContent = combined.slice(12 + 256);

    // 1. Decrypt AES key with RSA
    const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKey
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyRaw,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // 2. Decrypt content with AES
    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encryptedContent
    );

    return new TextDecoder().decode(decryptedContent);
  } catch (error) {
    console.error("Decryption failed:", error);
    return "[Unable to decrypt message]";
  }
};
