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

// --- Base64 Helpers ---
const b64Encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const b64Decode = (str: string): Uint8Array => {
  const binary = window.atob(str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

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

  // 4. Return as JSON string for easy detection and parsing
  return JSON.stringify({
    iv: uint8ArrayToBase64(iv),
    s: uint8ArrayToBase64(new Uint8Array(encryptedAesKeySender)),
    r: uint8ArrayToBase64(new Uint8Array(encryptedAesKeyRecipient)),
    c: uint8ArrayToBase64(new Uint8Array(encryptedContent))
  });
};

export const decryptMessage = async (jsonCipher: string, privateKey: CryptoKey, isSender: boolean): Promise<string> => {
  try {
    const data = JSON.parse(jsonCipher);
    if (!data.iv || !data.c || (!data.r && !data.s)) throw new Error("Invalid cipher format");

    const iv = base64ToUint8Array(data.iv);
    const encryptedAesKeyB64 = isSender ? data.s : data.r;
    const encryptedContent = base64ToUint8Array(data.c);

    // 1. Decrypt AES key with RSA
    const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToUint8Array(encryptedAesKeyB64) as any
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyRaw as any,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // 2. Decrypt content with AES
    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      aesKey as any,
      encryptedContent as any
    );

    return new TextDecoder().decode(decryptedContent as any);
  } catch (error: any) {
    console.error("Decryption failed:", error);
    return "[Unable to decrypt message]";
  }
};

/**
 * Encrypts a file (Blob) for both sender and recipient
 */
export const encryptFileForBoth = async (
  file: Blob, 
  fileName: string,
  fileSize: string,
  recipientPublicKeyPem: string, 
  myPublicKeyPem: string
): Promise<{ encryptedBlob: Blob; encryptedMetadata: string }> => {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);
  const myPublicKey = await importPublicKey(myPublicKeyPem);

  // 1. Generate a random AES key for this file
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Export the AES key to wrap it
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 3. Encrypt the AES key for both recipient and sender
  const encryptedKeyForRecipient = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    exportedAesKey
  );

  const encryptedKeyForMe = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    myPublicKey,
    exportedAesKey
  );

  // 4. Encrypt the file content with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileArrayBuffer = await file.arrayBuffer();
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    fileArrayBuffer
  );

  // 5. Encrypt Metadata (Name and Size) using same AES key
  const metaEncoder = new TextEncoder();
  const metaData = JSON.stringify({ name: fileName, size: fileSize });
  const encryptedMeta = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, // reuse same IV is generally safe if the key is unique
    aesKey,
    metaEncoder.encode(metaData)
  );

  // 6. Package everything into metadata string
  const metadata = JSON.stringify({
    r: b64Encode(new Uint8Array(encryptedKeyForRecipient)),
    s: b64Encode(new Uint8Array(encryptedKeyForMe)),
    iv: b64Encode(iv),
    m: b64Encode(new Uint8Array(encryptedMeta)) // Encrypted Metadata
  });

  return {
    encryptedBlob: new Blob([encryptedContent]),
    encryptedMetadata: metadata
  };
};

/**
 * Decrypts a file (Blob) using metadata and private key
 */
export const decryptFile = async (
  encryptedBlob: Blob,
  metadataStr: string,
  privateKey: CryptoKey,
  isSender: boolean
): Promise<{ decryptedBlob: Blob; fileName: string; fileSize: string }> => {
  const metadata = JSON.parse(metadataStr);
  const encryptedAesKeyB64 = isSender ? metadata.s : metadata.r;
  const iv = b64Decode(metadata.iv);

  // 1. Decrypt the AES key with RSA
  const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    b64Decode(encryptedAesKeyB64) as any
  ) as ArrayBuffer;

  // 2. Import the AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    decryptedAesKeyRaw,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 3. Decrypt the file content
  const encryptedContent = await encryptedBlob.arrayBuffer();
  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    encryptedContent
  );

  // 4. Decrypt metadata
  let fileName = "File";
  let fileSize = "Unknown";
  if (metadata.m) {
    try {
      const decryptedMetaBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        aesKey,
        b64Decode(metadata.m) as any
      );
      const meta = JSON.parse(new TextDecoder().decode(decryptedMetaBuffer as any));
      fileName = meta.name;
      fileSize = meta.size;
    } catch (e) {
      console.error("Metadata decryption failed:", e);
    }
  }

  return {
    decryptedBlob: new Blob([decryptedContent]),
    fileName,
    fileSize
  };
};
