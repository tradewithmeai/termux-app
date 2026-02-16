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
 * then export as PEM (private) and OpenSSH (public) strings.
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

  const privateKeyPem = derToPem(privateKeyDer, 'PRIVATE KEY');
  const publicKeyOpenSSH = spkiToOpenSSH(publicKeyDer, name);

  const key: SSHKey = {
    id: crypto.randomUUID(),
    name,
    publicKey: publicKeyOpenSSH,
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
 * Convert an SPKI DER public key to OpenSSH format (ssh-rsa AAAA... comment).
 * Parses the ASN.1 to extract RSA modulus and exponent, then encodes
 * in the SSH wire format: string "ssh-rsa" + mpint e + mpint n.
 */
function spkiToOpenSSH(spkiDer: ArrayBuffer, comment: string): string {
  const data = new Uint8Array(spkiDer);

  // Parse ASN.1 SEQUENCE -> SEQUENCE (algorithm) + BIT STRING (key data)
  // The RSA public key is inside the BIT STRING, which itself contains
  // a SEQUENCE of INTEGER (modulus) + INTEGER (exponent).
  // We need to find the BIT STRING and parse the inner SEQUENCE.
  let offset = 0;

  function readTag(): { tag: number; length: number } {
    const tag = data[offset++];
    let length = data[offset++];
    if (length & 0x80) {
      const numBytes = length & 0x7f;
      length = 0;
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | data[offset++];
      }
    }
    return { tag, length };
  }

  function readInteger(): Uint8Array {
    const { tag, length } = readTag();
    if (tag !== 0x02) throw new Error('Expected INTEGER');
    const value = data.slice(offset, offset + length);
    offset += length;
    return value;
  }

  // Outer SEQUENCE
  readTag(); // SEQUENCE
  // Algorithm SEQUENCE
  const algSeq = readTag(); // SEQUENCE
  offset += algSeq.length; // Skip algorithm OID
  // BIT STRING containing the public key
  const bitString = readTag(); // BIT STRING
  void bitString;
  offset++; // Skip unused-bits byte (0x00)
  // Inner SEQUENCE containing modulus + exponent
  readTag(); // SEQUENCE
  const modulus = readInteger();
  const exponent = readInteger();

  // Build SSH wire format: string "ssh-rsa" + mpint e + mpint n
  function sshString(s: string): Uint8Array {
    const encoded = new TextEncoder().encode(s);
    const buf = new Uint8Array(4 + encoded.length);
    new DataView(buf.buffer).setUint32(0, encoded.length);
    buf.set(encoded, 4);
    return buf;
  }

  function sshMpint(bytes: Uint8Array): Uint8Array {
    // Prepend 0x00 if high bit is set (SSH mpint is signed)
    const needsPad = bytes[0] & 0x80;
    const length = bytes.length + (needsPad ? 1 : 0);
    const buf = new Uint8Array(4 + length);
    new DataView(buf.buffer).setUint32(0, length);
    if (needsPad) {
      buf[4] = 0;
      buf.set(bytes, 5);
    } else {
      buf.set(bytes, 4);
    }
    return buf;
  }

  const keyType = sshString('ssh-rsa');
  const e = sshMpint(exponent);
  const n = sshMpint(modulus);

  const blob = new Uint8Array(keyType.length + e.length + n.length);
  blob.set(keyType, 0);
  blob.set(e, keyType.length);
  blob.set(n, keyType.length + e.length);

  return `ssh-rsa ${btoa(String.fromCharCode(...blob))} ${comment}`;
}

/**
 * Import a PEM private key from a string.
 * Validates PEM format before storing. The SSH proxy handles
 * the actual SSH authentication using the raw PEM.
 */
export async function importKeyFromPEM(name: string, privateKeyPem: string, publicKeyPem?: string): Promise<SSHKey> {
  const trimmed = privateKeyPem.trim();
  if (!trimmed.match(/^-----BEGIN .+ KEY-----/) || !trimmed.match(/-----END .+ KEY-----$/)) {
    throw new Error('Invalid PEM format: must start with -----BEGIN ... KEY----- and end with -----END ... KEY-----');
  }

  const key: SSHKey = {
    id: crypto.randomUUID(),
    name,
    publicKey: publicKeyPem || '(public key not provided)',
    privateKey: trimmed,
    createdAt: Date.now(),
  };

  await saveKey(key);
  return key;
}
