import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { validateBallot, mayExposeResults, canCreateSession, submissionPolicy, credentialVersionIsValid } from '../src/lib/ballot';
import { hashPassword, verifyEncodedPassword, verifyPassword } from '../src/lib/crypto';

const eligible = new Set(['se', 'it', 'fr', 'no', 'ua', 'es', 'pt', 'fi', 'ch', 'nl', 'be']);
const validScores = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1].map((points, index) => ({ points, countryId: [...eligible][index + 1]! }));

describe('authentication and authorization', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const encoded = await hashPassword('NXV-a-strong-password', 100_000);
    expect(encoded.hash).not.toContain('strong-password');
    await expect(verifyPassword('NXV-a-strong-password', encoded.salt, encoded.hash, encoded.iterations)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', encoded.salt, encoded.hash, encoded.iterations)).resolves.toBe(false);
  });

  it('rejects PBKDF2 iteration counts unsupported by Cloudflare Workers', async () => {
    await expect(verifyEncodedPassword('password', 'pbkdf2$310000$c2FsdA$aGFzaA')).resolves.toBe(false);
  });

  it('rejects protected routes without bearer authentication', async () => {
    const adminResponse = await app.request('/api/admin/dashboard', {}, {} as never);
    const juryResponse = await app.request('/api/jury/ballot', {}, {} as never);
    expect(adminResponse.status).toBe(401);
    expect(juryResponse.status).toBe(401);
  });

  it('enforces one active session while allowing the same session to reconnect', () => {
    expect(canCreateSession(false, false)).toBe(true);
    expect(canCreateSession(true, true)).toBe(true);
    expect(canCreateSession(true, false)).toBe(false);
  });

  it('invalidates existing sessions after password rotation', () => {
    expect(credentialVersionIsValid(3, 3)).toBe(true);
    expect(credentialVersionIsValid(3, 4)).toBe(false);
  });
});

describe('ballot integrity', () => {
  it('accepts a complete valid ballot', () => expect(validateBallot(validScores, 'se', eligible)).toEqual([]));

  it('rejects self-voting', () => {
    const scores = validScores.map((score, index) => index === 0 ? { ...score, countryId: 'se' } : score);
    expect(validateBallot(scores, 'se', eligible)).toContain('A jury cannot vote for its own country.');
  });

  it('rejects duplicate country selections', () => {
    const scores = validScores.map((score, index) => index === 1 ? { ...score, countryId: validScores[0]!.countryId } : score);
    expect(validateBallot(scores, 'se', eligible)).toContain('Each country may receive points only once.');
  });

  it('rejects incomplete ballots', () => {
    expect(validateBallot(validScores.slice(0, 9), 'se', eligible)).toContain('A complete ballot must contain exactly 10 selections.');
  });

  it('rejects duplicate submissions and closed voting', () => {
    expect(submissionPolicy(true, true)).toEqual({ allowed: false, code: 'BALLOT_ALREADY_SUBMITTED' });
    expect(submissionPolicy(false, false)).toEqual({ allowed: false, code: 'VOTING_CLOSED' });
    expect(submissionPolicy(true, false)).toEqual({ allowed: true });
  });
});

describe('result visibility', () => {
  it('never exposes unpublished results to public callers', () => {
    expect(mayExposeResults(false, false)).toBe(false);
    expect(mayExposeResults(false, true)).toBe(true);
    expect(mayExposeResults(true, false)).toBe(true);
  });
});

