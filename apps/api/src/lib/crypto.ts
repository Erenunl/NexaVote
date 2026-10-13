const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const input = typeof value === 'string' ? encoder.encode(value) : value;
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', input)));
}

export async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export async function passwordLookup(password: string, pepper: string): Promise<string> {
  return hmacSha256(pepper, password.trim());
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<{ salt: string; hash: string; iterations: number }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, material, 256);
  return { salt: toBase64Url(saltBytes), hash: toBase64Url(new Uint8Array(bits)), iterations };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string, iterations: number): Promise<boolean> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = fromBase64Url(salt);
  const saltBuffer = saltBytes.buffer.slice(saltBytes.byteOffset, saltBytes.byteOffset + saltBytes.byteLength) as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations }, material, 256);
  return timingSafeEqual(toBase64Url(new Uint8Array(bits)), expectedHash);
}

export function timingSafeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

export async function verifyEncodedPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, salt, hash] = encoded.split('$');
  if (algorithm !== 'pbkdf2' || !iterationsText || !salt || !hash) return false;
  const iterations = Number(iterationsText);
  return Number.isSafeInteger(iterations)
    && iterations === PBKDF2_ITERATIONS
    && verifyPassword(password, salt, hash, iterations);
}

export async function encodePassword(password: string): Promise<string> {
  const result = await hashPassword(password);
  return `pbkdf2$${result.iterations}$${result.salt}$${result.hash}`;
}

