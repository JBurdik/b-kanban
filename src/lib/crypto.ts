/**
 * Client-side encryption utilities using WebCrypto API
 * Uses AES-256-GCM with PBKDF2 key derivation for E2E encryption
 */

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate cryptographically secure random bytes
function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// Derive encryption key from passphrase using PBKDF2
async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000, // OWASP recommended minimum
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedData {
  encryptedValue: string; // Base64
  iv: string; // Base64
  salt: string; // Base64
}

/**
 * Encrypt a plaintext value with a passphrase
 * Uses AES-256-GCM with PBKDF2 key derivation
 */
export async function encryptSecret(
  plaintext: string,
  passphrase: string
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const salt = generateRandomBytes(16);
  const iv = generateRandomBytes(12);
  const key = await deriveKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plaintext)
  );

  return {
    encryptedValue: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt an encrypted value with a passphrase
 * Throws if passphrase is incorrect
 */
export async function decryptSecret(
  encryptedData: EncryptedData,
  passphrase: string
): Promise<string> {
  const decoder = new TextDecoder();
  const salt = new Uint8Array(base64ToArrayBuffer(encryptedData.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
  const ciphertext = base64ToArrayBuffer(encryptedData.encryptedValue);

  const key = await deriveKey(passphrase, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext
    );
    return decoder.decode(decrypted);
  } catch {
    throw new Error("Decryption failed - incorrect passphrase");
  }
}

/**
 * Verify a passphrase works for given encrypted data
 * Returns true if passphrase is correct, false otherwise
 */
export async function verifyPassphrase(
  encryptedData: EncryptedData,
  passphrase: string
): Promise<boolean> {
  try {
    await decryptSecret(encryptedData, passphrase);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check passphrase strength
 * Returns a score from 0-4 and feedback
 */
export function checkPassphraseStrength(passphrase: string): {
  score: number;
  feedback: string;
} {
  let score = 0;
  const feedback: string[] = [];

  if (passphrase.length >= 8) score++;
  else feedback.push("At least 8 characters");

  if (passphrase.length >= 12) score++;

  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score++;
  else feedback.push("Mix uppercase and lowercase");

  if (/\d/.test(passphrase)) score++;
  else feedback.push("Add numbers");

  if (/[^a-zA-Z0-9]/.test(passphrase)) score++;
  else feedback.push("Add special characters");

  const strengthLabels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];

  return {
    score: Math.min(score, 4),
    feedback:
      feedback.length > 0
        ? feedback.join(", ")
        : strengthLabels[Math.min(score, 4)],
  };
}
