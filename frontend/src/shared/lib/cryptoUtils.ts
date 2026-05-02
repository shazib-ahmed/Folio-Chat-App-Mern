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
const MESSAGE_STORE_NAME = "messages";

// --- Base64 Helpers ---
const b64Encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const b64Decode = (str: string): Uint8Array => {
  if (typeof str !== 'string') {
    console.error("b64Decode: Expected string, got", typeof str, str);
    return new Uint8Array(0);
  }
  // Strip PEM headers/footers and whitespace
  const cleanStr = str.replace(/-----BEGIN [A-Z ]+-----|-----END [A-Z ]+-----|\s/g, "").trim();
  try {
    const binary = window.atob(cleanStr);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("b64Decode failed for string:", cleanStr.substring(0, 20) + "...");
    throw e;
  }
};

// --- IndexedDB Storage ---

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Version 2 for messages store
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(MESSAGE_STORE_NAME)) {
        db.createObjectStore(MESSAGE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const keyCache: { [userId: string]: { privateKey: CryptoKey; publicKey: CryptoKey } } = {};

export const saveKeys = async (userId: string, keys: CryptoKeyPair): Promise<void> => {
  keyCache[userId] = { privateKey: keys.privateKey, publicKey: keys.publicKey };
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(keys.privateKey, `privateKey_${userId}`);
  store.put(keys.publicKey, `publicKey_${userId}`);
};

export const getLocalKeys = async (userId: string): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey } | null> => {
  if (keyCache[userId]) return keyCache[userId];
  
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  
  const privReq = store.get(`privateKey_${userId}`);
  const pubReq = store.get(`publicKey_${userId}`);
  
  return new Promise((resolve) => {
    let priv: CryptoKey | null = null;
    let pub: CryptoKey | null = null;
    
    privReq.onsuccess = () => {
      priv = privReq.result;
      if (priv && pub) {
        resolve({ privateKey: priv, publicKey: pub });
      }
    };
    pubReq.onsuccess = () => {
      pub = pubReq.result;
      if (priv && pub) {
        resolve({ privateKey: priv, publicKey: pub });
      }
    };
    
    tx.oncomplete = async () => {
      if (priv && pub) {
        keyCache[userId] = { privateKey: priv, publicKey: pub };
        resolve({ privateKey: priv, publicKey: pub });
      } else {
        // --- Migration Logic ---
        // If user-specific keys aren't found, check for old generic keys
        const mTx = db.transaction(STORE_NAME, "readwrite");
        const mStore = mTx.objectStore(STORE_NAME);
        
        const legacyPrivReq = mStore.get("privateKey");

        const legacyPriv: CryptoKey | null = await new Promise(r => {
          legacyPrivReq.onsuccess = () => r(legacyPrivReq.result);
          legacyPrivReq.onerror = () => r(null);
        });

        if (legacyPriv) {
           // We found a legacy key! Migrate it to the current user.
           mStore.put(legacyPriv, `privateKey_${userId}`);
           
           // We might not have a legacy public key, but that's okay for decryption
           keyCache[userId] = { privateKey: legacyPriv, publicKey: null as any }; 
           resolve({ privateKey: legacyPriv, publicKey: null as any });
           
           // Clean up legacy key to prevent multiple migrations
           mStore.delete("privateKey");
        } else {
           resolve(null);
        }
      }
    };
    tx.onerror = () => resolve(null);
  });
};

export const getLocalPrivateKey = async (userId: string): Promise<CryptoKey | null> => {
  const keys = await getLocalKeys(userId);
  return keys ? keys.privateKey : null;
};

// --- Helpers ---

const uint8ArrayToBase64 = b64Encode;

const base64ToUint8Array = (base64: string): Uint8Array => {
  return b64Decode(base64);
};

// --- Key Management ---

export const generateE2EEKeys = async (): Promise<CryptoKeyPair> => {
  return window.crypto.subtle.generateKey(KEY_PAIR_ALGORITHM, true, ["encrypt", "decrypt"]);
};

export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  return uint8ArrayToBase64(new Uint8Array(exported));
};

export const importPublicKey = async (pem: any): Promise<CryptoKey> => {
  let finalPem = pem;
  try {
    // Check if it's already an object
    if (typeof pem === 'object' && pem !== null) {
      if (pem.pub) finalPem = pem.pub;
    }
    // Check if it's a JSON string
    else if (typeof pem === 'string' && pem.startsWith('{')) {
      const parsed = JSON.parse(pem);
      if (parsed.pub) finalPem = parsed.pub;
    }
  } catch (e) {}

  const bytes = base64ToUint8Array(finalPem);
  return window.crypto.subtle.importKey("spki", bytes.buffer as ArrayBuffer, KEY_PAIR_ALGORITHM, true, ["encrypt"]);
};

export const exportPrivateKey = async (privateKey: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);
  return uint8ArrayToBase64(new Uint8Array(exported));
};

export const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const bytes = base64ToUint8Array(pem);
  return window.crypto.subtle.importKey("pkcs8", bytes.buffer as ArrayBuffer, KEY_PAIR_ALGORITHM, true, ["decrypt"]);
};

// --- Encryption / Decryption ---

/**
 * Hybrid Encryption (Multi-Recipient):
 * 1. Generates a random AES-GCM session key.
 * 2. Encrypts the payload with the AES key.
 * 3. Encrypts the AES session key for both the sender and recipient using their RSA Public Keys.
 * 4. Returns a JSON-stringified package containing IV, encrypted keys, and ciphertext.
 * 
 * @param text The plain text message to encrypt.
 * @param recipientPubKeyPem The recipient's RSA public key in PEM format.
 * @param senderPubKeyPem The sender's RSA public key in PEM format.
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

export const isEncryptedPayload = (val: any): boolean => {
  if (typeof val !== 'string') return false;
  if (!val.startsWith('{') || !val.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(val);
    return !!(parsed.iv && (parsed.r || parsed.s));
  } catch {
    return false;
  }
};

/**
 * Hybrid Decryption:
 * 1. Decrypts the AES-GCM session key using the provided RSA Private Key.
 * 2. Decrypts the ciphertext using the recovered AES key.
 * 
 * @param jsonCipher The JSON package containing the encrypted message data.
 * @param privateKey The recipient's RSA Private Key.
 * @param isSender Boolean indicating if the current user is the original sender.
 * @param msgId Optional message identifier for error tracing.
 */
export const decryptMessage = async (jsonCipher: string, privateKey: CryptoKey, isSender: boolean, msgId?: string): Promise<string> => {
  try {
    if (!jsonCipher || !isEncryptedPayload(jsonCipher)) return jsonCipher || "";
    
    const data = JSON.parse(jsonCipher);
    const iv = base64ToUint8Array(data.iv);
    const encryptedAesKeyB64 = isSender ? data.s : data.r;
    
    if (!encryptedAesKeyB64) return "[Decryption key missing]";

    const encryptedContent = base64ToUint8Array(data.c || data.text || "");
    if (!encryptedContent || encryptedContent.length === 0) {
      if (data.m) return ""; // File metadata only
      console.error(`DEBUG: Empty encrypted content for msg ${msgId}`);
      return "[Empty content]";
    }

    if (!iv || iv.length === 0) {
      console.error(`DEBUG: Missing IV for msg ${msgId}`);
      return "[Missing IV]";
    }

    // 1. Decrypt AES key with RSA
    let encryptedAesKeyToUse = encryptedAesKeyB64;
    let decryptedAesKeyRaw: ArrayBuffer;

    try {
      decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        base64ToUint8Array(encryptedAesKeyToUse) as any
      ) as ArrayBuffer;
    } catch (err) {
      // Fallback: Try the other key slot
      encryptedAesKeyToUse = isSender ? data.r : data.s;
      if (!encryptedAesKeyToUse) {
        console.error("DEBUG: No fallback key slot available in payload:", data);
        throw new Error("No fallback key slot available");
      }
      
      decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        base64ToUint8Array(encryptedAesKeyToUse) as any
      ) as ArrayBuffer;
    }

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
    console.error(`Decryption failed for msg ${msgId || 'unknown'}:`, error);
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
  let encryptedAesKeyB64 = isSender ? metadata.s : metadata.r;
  const iv = b64Decode(metadata.iv);
  let decryptedAesKey: ArrayBuffer;

  try {
    decryptedAesKey = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      b64Decode(encryptedAesKeyB64) as any
    ) as ArrayBuffer;
  } catch (err) {
    // Fallback: Try the other key slot
    encryptedAesKeyB64 = isSender ? metadata.r : metadata.s;
    if (!encryptedAesKeyB64) throw new Error("No fallback key slot available");
    
    decryptedAesKey = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      b64Decode(encryptedAesKeyB64) as any
    ) as ArrayBuffer;
  }

  // 2. Import the AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    decryptedAesKey,
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
/**
 * Re-wraps file metadata for a new recipient when forwarding
 */
export const rewrapFileMeta = async (
  metadataStr: string,
  privateKey: CryptoKey,
  isOriginalSender: boolean,
  newRecipientPubKeyPem: string,
  newMyPubKeyPem: string
): Promise<string> => {
  try {
    const metadata = JSON.parse(metadataStr);
    const encryptedAesKeyB64 = isOriginalSender ? metadata.s : metadata.r;
    
    if (!encryptedAesKeyB64) throw new Error("Encryption key missing in metadata");

    // 1. Decrypt original AES key
    const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      b64Decode(encryptedAesKeyB64) as any
    );

    // 2. Import new public keys
    const recipientPubKey = await importPublicKey(newRecipientPubKeyPem);
    const myPubKey = await importPublicKey(newMyPubKeyPem);

    // 3. Re-encrypt for new parties
    const newR = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPubKey, decryptedAesKeyRaw);
    const newS = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, myPubKey, decryptedAesKeyRaw);

    return JSON.stringify({
      ...metadata,
      r: b64Encode(new Uint8Array(newR)),
      s: b64Encode(new Uint8Array(newS))
    });
  } catch (err) {
    console.error("Re-wrapping file metadata failed:", err);
    return metadataStr; // Fallback to original
  }
};

// --- Message Caching ---

export const saveCachedMessages = async (chatId: string, messages: any[]) => {
  try {
    const db = await getDB();
    const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MESSAGE_STORE_NAME);
    
    // Store only the last 10 messages
    const last10 = messages.slice(-10);
    await store.put(last10, chatId);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save messages to cache:", err);
  }
};

export const getCachedMessages = async (chatId: string): Promise<any[]> => {
  try {
    const db = await getDB();
    const tx = db.transaction(MESSAGE_STORE_NAME, 'readonly');
    const store = tx.objectStore(MESSAGE_STORE_NAME);
    const request = store.get(chatId);
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error("Failed to get messages from cache:", err);
    return [];
  }
};

/**
 * Batch Decryption Utility:
 * Efficiently decrypts an array of messages using a single Private Key instance.
 * Handles complex message objects including text, file metadata, and replies.
 * 
 * @param messages Array of encrypted message objects.
 * @param privateKey The RSA Private Key for decryption.
 * @param currentUserId The ID of the current user (used to identify sender/recipient slots).
 */
export const decryptMessageBatch = async (messages: any[], privateKey: CryptoKey | null, currentUserId?: string) => {
  if (!messages || messages.length === 0) return [];
  if (!privateKey) return messages;

  return await Promise.all(messages.map(async (msg: any) => {
    if (!msg.isEncrypted) return msg;

    let decryptedText = msg.text;
    let decryptedFileUrl = msg.fileUrl;
    let decryptedFileName = msg.fileName;
    let fileMeta = "";

    const isSender = currentUserId ? String(msg.senderId) === String(currentUserId) : false;

    // 1. Extract fileMeta and potentially decrypt text
    if (msg.text && (isEncryptedPayload(msg.text) || msg.text.includes('"fileMeta"'))) {
      try {
        const parsed = JSON.parse(msg.text);
        if (parsed.fileMeta) {
          decryptedText = parsed.text ? await decryptMessage(parsed.text, privateKey, isSender, msg.id) : "";
          fileMeta = parsed.fileMeta;
        } else if (parsed.iv) {
          if (parsed.c || parsed.text) {
            decryptedText = await decryptMessage(msg.text, privateKey, isSender, msg.id);
          } else if (parsed.m) {
            fileMeta = msg.text;
            decryptedText = "";
          }
        }
      } catch (e) {
        console.error("Batch Decryption: Failed to parse message JSON:", e);
      }
    }

    if (msg.fileUrl && isEncryptedPayload(msg.fileUrl)) {
      decryptedFileUrl = await decryptMessage(msg.fileUrl, privateKey, isSender, msg.id);
    }

    if (msg.fileName && isEncryptedPayload(msg.fileName)) {
      decryptedFileName = await decryptMessage(msg.fileName, privateKey, isSender, msg.id);
    }

    let decryptedFileSize = msg.fileSize;
    if (msg.fileSize && isEncryptedPayload(msg.fileSize)) {
      decryptedFileSize = await decryptMessage(msg.fileSize, privateKey, isSender, msg.id);
    }

    let decryptedReply = msg.replyTo;
    if (msg.replyTo) {
      try {
        const isReplySender = currentUserId ? String(msg.replyTo.senderId) === String(currentUserId) : false;
        let text = msg.replyTo.text;

        if (msg.replyTo.text && isEncryptedPayload(msg.replyTo.text)) {
          text = await decryptMessage(msg.replyTo.text, privateKey, isReplySender);
        }

        if (!text && msg.replyTo.messageType !== 'TEXT') {
          const labels: any = { 'IMAGE': '📷 Photo', 'VIDEO': '🎥 Video', 'AUDIO': '🎵 Audio', 'FILE': '📄 File' };
          text = labels[msg.replyTo.messageType] || '📄 Attachment';
        }

        decryptedReply = { ...msg.replyTo, text };
      } catch (e) { }
    }

    return {
      ...msg,
      text: decryptedText,
      fileUrl: decryptedFileUrl,
      fileName: decryptedFileName,
      fileSize: decryptedFileSize,
      fileMeta,
      replyTo: decryptedReply
    };
  }));
};
