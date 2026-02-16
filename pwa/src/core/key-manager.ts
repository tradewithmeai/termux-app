/**
 * SSH key management using IndexedDB for storage.
 * Keys are stored as PEM strings (not Web Crypto objects)
 * since SSH keys use specific formats not natively supported
 * by the Web Crypto API.
 */

export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

const DB_NAME = 'termux-pwa-keys';
const STORE_NAME = 'ssh-keys';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listKeys(): Promise<SSHKey[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveKey(key: SSHKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteKey(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getKey(id: string): Promise<SSHKey | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generate an RSA key pair using Web Crypto API,
 * then export as PEM strings for SSH use.
 */
export async function generateKeyPair(name: string): Promise<SSHKey> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const publicKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyPem = derToPem(publicKeyDer, 'PUBLIC KEY');
  const privateKeyPem = derToPem(privateKeyDer, 'PRIVATE KEY');

  const key: SSHKey = {
    id: crypto.randomUUID(),
    name,
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    createdAt: Date.now(),
  };

  await saveKey(key);
  return key;
}

function derToPem(der: ArrayBuffer, label: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/**
 * Import a PEM private key from a string.
 * Stores the raw PEM — no Web Crypto import needed since
 * the SSH proxy handles the actual SSH authentication.
 */
export async function importKeyFromPEM(name: string, privateKeyPem: string, publicKeyPem?: string): Promise<SSHKey> {
  const key: SSHKey = {
    id: crypto.randomUUID(),
    name,
    publicKey: publicKeyPem || '(public key not provided)',
    privateKey: privateKeyPem,
    createdAt: Date.now(),
  };

  await saveKey(key);
  return key;
}
