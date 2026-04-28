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

// --- Helpers ---

const uint8ArrayToBase64 = (arr: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
};

// --- Key Management ---

export const generateE2EEKeys = async (): Promise<CryptoKeyPair> => {
  return window.crypto.subtle.generateKey(KEY_PAIR_ALGORITHM, true, ["encrypt", "decrypt"]);
};

export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  return uint8ArrayToBase64(new Uint8Array(exported));
};

export const importPublicKey = async (pem: string): Promise<CryptoKey> => {
  const bytes = base64ToUint8Array(pem);
  return window.crypto.subtle.importKey("spki", bytes.buffer as ArrayBuffer, KEY_PAIR_ALGORITHM, true, ["encrypt"]);
};

// --- Encryption / Decryption ---

/**
 * Hybrid Encryption (Multi-Recipient):
 * 1. Generates random AES-GCM key.
 * 2. Encrypts text with AES-GCM.
 * 3. Encrypts AES key TWICE:
 *    - Once with the recipient's RSA Public Key.
 *    - Once with the sender's RSA Public Key.
 * 4. Returns combined base64 string.
 * Format: IV(12) | SenderEncAesKey(256) | RecipientEncAesKey(256) | EncryptedContent
 */
export const encryptForBoth = async (text: string, recipientPubKeyPem: string, senderPubKeyPem: string): Promise<string> => {
  const recipientKey = await importPublicKey(recipientPubKeyPem);
  const senderKey = await importPublicKey(senderPubKeyPem);

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

  // 3. Encrypt AES key for both parties
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  
  const encryptedAesKeySender = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderKey,
    exportedAesKey
  );

  const encryptedAesKeyRecipient = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientKey,
    exportedAesKey
  );

  // 4. Combine: IV(12) | SenderKey(256) | RecipientKey(256) | Content
  const combined = new Uint8Array(12 + 256 + 256 + encryptedContent.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedAesKeySender), 12);
  combined.set(new Uint8Array(encryptedAesKeyRecipient), 12 + 256);
  combined.set(new Uint8Array(encryptedContent), 12 + 256 + 256);

  return uint8ArrayToBase64(combined);
};

export const decryptMessage = async (base64Cipher: string, privateKey: CryptoKey, isSender: boolean): Promise<string> => {
  try {
    const combined = base64ToUint8Array(base64Cipher);

    const iv = combined.slice(0, 12);
    
    // Pick the correct encrypted AES key based on whether we are the sender or receiver
    const encryptedAesKey = isSender 
      ? combined.slice(12, 12 + 256) 
      : combined.slice(12 + 256, 12 + 256 + 256);
      
    const encryptedContent = combined.slice(12 + 256 + 256);

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
  } catch (error: any) {
    console.error("Decryption failed detail:", {
      error: error.message || error,
      cipherLength: base64Cipher.length,
      name: error.name
    });
    return "[Unable to decrypt message]";
  }
};
