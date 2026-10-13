import { POINTS } from '../types';

export interface ScoreInput { countryId: string; points: number }

export function validateBallot(scores: ScoreInput[], juryCountryId: string, eligibleCountryIds: Set<string>): string[] {
  const errors: string[] = [];
  if (scores.length !== POINTS.length) errors.push('A complete ballot must contain exactly 10 selections.');

  const countries = new Set<string>();
  const awardedPoints = new Set<number>();
  for (const score of scores) {
    if (score.countryId === juryCountryId) errors.push('A jury cannot vote for its own country.');
    if (!eligibleCountryIds.has(score.countryId)) errors.push('The ballot contains an ineligible country.');
    if (countries.has(score.countryId)) errors.push('Each country may receive points only once.');
    if (awardedPoints.has(score.points)) errors.push('Each point value may be awarded only once.');
    if (!(POINTS as readonly number[]).includes(score.points)) errors.push('The ballot contains an invalid point value.');
    countries.add(score.countryId);
    awardedPoints.add(score.points);
  }

  if (POINTS.some((points) => !awardedPoints.has(points))) errors.push('Every required point value must be assigned.');
  return [...new Set(errors)];
}

export function mayExposeResults(resultsPublic: boolean, isAdmin: boolean): boolean {
  return isAdmin || resultsPublic;
}

export function canCreateSession(existingActiveSession: boolean, sameToken: boolean): boolean {
  return !existingActiveSession || sameToken;
}

export function submissionPolicy(votingOpen: boolean, alreadySubmitted: boolean): { allowed: boolean; code?: string } {
  if (!votingOpen) return { allowed: false, code: 'VOTING_CLOSED' };
  if (alreadySubmitted) return { allowed: false, code: 'BALLOT_ALREADY_SUBMITTED' };
  return { allowed: true };
}

export function credentialVersionIsValid(sessionVersion: number, currentVersion: number): boolean {
  return sessionVersion === currentVersion;
}

