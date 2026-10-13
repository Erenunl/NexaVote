import type { Context } from 'hono';

export interface Bindings {
  DB: D1Database;
  PASSWORD_PEPPER: string;
  ADMIN_PASSWORD_HASH: string;
  BOT_API_KEY_ID: string;
  BOT_API_SECRET: string;
  ALLOWED_ORIGINS: string;
  SESSION_TTL_MINUTES?: string;
  ADMIN_SESSION_TTL_MINUTES?: string;
}

export interface JurySession {
  sessionId: string;
  editionId: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  flagEmoji: string;
  credentialVersion: number;
}

export interface AppVariables {
  jury: JurySession;
  adminSessionId: string;
  integrationKeyId: string;
}

export type AppContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

export const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

