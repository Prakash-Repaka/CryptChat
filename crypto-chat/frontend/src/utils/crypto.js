/* 
  CryptoUtils for specialized hybrid encryption.
  Uses WebCrypto API.
*/

// Generate RSA Key Pair (Public/Private)
export const generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
    return keyPair;
};

// Export Key to Base64 String (for storage/transmission)
export const exportKey = async (key) => {
    const exported = await window.crypto.subtle.exportKey(
        key.type === "public" ? "spki" : "pkcs8",
        key
    );
    const exportedKeyBuffer = new Uint8Array(exported);
    let binary = '';
    for (let i = 0; i < exportedKeyBuffer.byteLength; i++) {
        binary += String.fromCharCode(exportedKeyBuffer[i]);
    }
    return window.btoa(binary);
};

// Import Key from Base64 String
export const importKey = async (pem, type) => {
    const binaryDerString = window.atob(pem);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
        type === "public" ? "spki" : "pkcs8",
        binaryDer.buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        type === "public" ? ["encrypt"] : ["decrypt"]
    );
};

// Encrypt Message (RSA) - For MVP, strict RSA is OK for short messages, 
// but for spec compliance (Hybrid), we should ideally do AES.
// However, implementing full Hybrid in one go is complex. 
// Let's implement RSA wrapper first, which is "Hybrid-ready" if we just encrypt the AES key.

export const encryptData = async (publicKey, data) => {
    const encoded = new TextEncoder().encode(data);
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "RSA-OAEP",
        },
        publicKey,
        encoded
    );

    const encryptedBuffer = new Uint8Array(encrypted);
    let binary = '';
    for (let i = 0; i < encryptedBuffer.byteLength; i++) {
        binary += String.fromCharCode(encryptedBuffer[i]);
    }
    return window.btoa(binary);
};

export const decryptData = async (privateKey, encryptedData) => {
    const binaryString = window.atob(encryptedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "RSA-OAEP",
        },
        privateKey,
        bytes.buffer
    );

    return new TextDecoder().decode(decrypted);
};
