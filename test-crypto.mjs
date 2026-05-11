import { webcrypto } from 'crypto';
const { subtle, getRandomValues } = webcrypto;

const SECURITY_LIMITS = { SALT_LENGTH: 16, PIN_ITERATIONS: 100000 };

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

async function run() {
  const salt = getRandomValues(new Uint8Array(SECURITY_LIMITS.SALT_LENGTH));
  
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode('1234'),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits1 = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: SECURITY_LIMITS.PIN_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  
  const hash1 = bufferToHex(derivedBits1);
  const saltHex = bufferToHex(salt);
  
  const salt2 = hexToBuffer(saltHex);
  const derivedBits2 = await subtle.deriveBits(
    { name: 'PBKDF2', salt: salt2, iterations: SECURITY_LIMITS.PIN_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  
  const hash2 = bufferToHex(derivedBits2);
  console.log("hash1:", hash1);
  console.log("hash2:", hash2);
  console.log("Match:", hash1 === hash2);
}

run().catch(console.error);
