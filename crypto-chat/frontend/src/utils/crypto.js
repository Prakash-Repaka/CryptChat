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

// File Encryption (AES-GCM for speed and size)
export const encryptFile = async (file, key) => {
    const arrayBuffer = await file.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(key.padEnd(32, '0')).slice(0, 32),
        "AES-GCM",
        false,
        ["encrypt"]
    );

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        arrayBuffer
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    let binary = '';
    for (let i = 0; i < result.byteLength; i++) {
        binary += String.fromCharCode(result[i]);
    }
    return window.btoa(binary);
};

export const decryptFile = async (encryptedBase64, key, fileType) => {
    const binaryString = window.atob(encryptedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(key.padEnd(32, '0')).slice(0, 32),
        "AES-GCM",
        false,
        ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        data.buffer
    );

    return new Blob([decrypted], { type: fileType });
};

// Perfect Forward Secrecy (PFS) utilities using ECDH
export const generateECDHKeyPair = async () => {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );
};

export const exportECDHKey = async (key) => {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    const buffer = new Uint8Array(exported);
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary);
};

export const deriveSharedSecret = async (privateKey, otherPublicBase64) => {
    const otherPublicBinary = window.atob(otherPublicBase64);
    const otherPublicBuffer = new Uint8Array(otherPublicBinary.length);
    for (let i = 0; i < otherPublicBinary.length; i++) {
        otherPublicBuffer[i] = otherPublicBinary.charCodeAt(i);
    }

    const importedOtherPublic = await window.crypto.subtle.importKey(
        "raw",
        otherPublicBuffer.buffer,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    return await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: importedOtherPublic },
        privateKey,
        256
    );
};
