import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const readline = createInterface({ input: stdin, output: stdout });
const password = await readline.question('Admin password (input is visible; run in a private terminal): ');
readline.close();
if (password.length < 14) {
  console.error('Use at least 14 characters.');
  process.exit(1);
}
const salt = randomBytes(16);
const iterations = 310_000;
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const base64url = (value) => value.toString('base64url');
console.log(`pbkdf2$${iterations}$${base64url(salt)}$${base64url(hash)}`);

