import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.APP_ENCRYPTION_KEY;

export const encryptData = (data: any): string => {
  if (!SECRET_KEY) {
    console.error('Encryption error: APP_ENCRYPTION_KEY is not defined');
    return '';
  }
  try {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
};

export const decryptData = (encryptedData: string): any => {
  if (!SECRET_KEY) {
    console.error('Decryption error: APP_ENCRYPTION_KEY is not defined');
    return null;
  }
  try {
    if (!encryptedData) return null;
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};
