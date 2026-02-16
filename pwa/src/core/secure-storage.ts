/**
 * Encrypted credential storage using Web Crypto API.
 * Uses AES-GCM with a device-specific key stored in IndexedDB.
 * localStorage holds only encrypted ciphertext — never plaintext passwords.
 */

const DB_NAME = 'termux-pwa-secure';
const STORE_NAME = 'keys';
const DEVICE_KEY_ID = 'device-encryption-key';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getDeviceKey(): Promise<CryptoKey> {
  const db = await openDB();

  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(DEVICE_KEY_ID);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(key, DEVICE_KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return key;
}

/**
 * Encrypt a string for localStorage storage.
 * Returns a base64 string containing IV + ciphertext.
 */
export async function encryptForStorage(plaintext: string): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 string from localStorage.
 * Returns the original plaintext string, or null if decryption fails
 * (e.g. legacy plaintext data or corrupted ciphertext).
 */
export async function decryptFromStorage(encrypted: string): Promise<string | null> {
  try {
    const key = await getDeviceKey();
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    if (combined.length < 13) return null; // IV (12) + at least 1 byte

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
