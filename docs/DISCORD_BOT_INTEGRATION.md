# Nexavision Discord Bot API Integration Guide

This document is the complete handoff contract for the separate Discord bot project. The Nexavision website and bot are independent deployments. The website and voting API continue to work when the bot is offline.

## Scope boundary

The website repository contains no Discord.js dependency, slash commands, event handlers, DM logic, or bot hosting configuration. The bot owns Discord interactions and private-message delivery. The Nexavision API owns country mappings, password hashes, delivery state, jury activity, and ballot completion.

## Base URL and version

Production base URL: `https://YOUR_WORKER.workers.dev/api/integration/v1`

All endpoints below are under `/api/integration/v1`. Version `v1` is stable; breaking changes must use a new version.

## Machine-to-machine authentication

Every request, including `GET`, must include:

| Header | Value |
| --- | --- |
| `X-Nexavision-Key-Id` | The configured `BOT_API_KEY_ID` |
| `X-Nexavision-Timestamp` | Current UTC ISO-8601 timestamp, for example `2026-10-13T17:00:00.000Z` |
| `X-Nexavision-Nonce` | A fresh random base64url string, 16–128 characters |
| `X-Nexavision-Signature` | Base64url HMAC-SHA256 signature described below |
| `Content-Type` | `application/json` when a body is present |

The API rejects timestamps more than five minutes from server time and stores each nonce to prevent replay. Never reuse a nonce. Keep `BOT_API_SECRET` only in the bot runtime's secret manager.

Canonical signing payload (exact newlines, no trailing newline):

```text
HTTP_METHOD
/api/integration/v1/path
ISO_TIMESTAMP
NONCE
BASE64URL_SHA256_OF_RAW_BODY
```

Sign the UTF-8 payload with HMAC-SHA256 using `BOT_API_SECRET`, then encode the signature as unpadded base64url. Hash the exact bytes sent as the request body. For bodyless requests, hash an empty byte sequence.

Reference Node.js signing helper for the bot team:

```js
import { createHash, createHmac, randomBytes } from 'node:crypto';

export function signNexavisionRequest({ method, path, body = '', keyId, secret }) {
  const timestamp = new Date().toISOString();
  const nonce = randomBytes(24).toString('base64url');
  const bodyHash = createHash('sha256').update(body).digest('base64url');
  const canonical = [method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\n');
  const signature = createHmac('sha256', secret).update(canonical).digest('base64url');
  return {
    'Content-Type': 'application/json',
    'X-Nexavision-Key-Id': keyId,
    'X-Nexavision-Timestamp': timestamp,
    'X-Nexavision-Nonce': nonce,
    'X-Nexavision-Signature': signature,
  };
}
```

## Error format

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "A safe, non-secret explanation."
  }
}
```

Expected status codes: `400` invalid request, `401` bad/stale signature, `404` missing edition or country, `409` replay/conflict, `429` throttled, `500` unexpected error. Do not display raw `500` details to Discord users.

## Endpoints

### List the current edition and participating countries

`GET /editions/current/countries`

Response:

```json
{
  "edition": { "id": "edition-2026", "name": "Nexavision 2026", "slug": "nexavision-2026", "phase": "open" },
  "countries": [
    {
      "countryId": "country-se",
      "code": "SE",
      "country": "Sweden",
      "flag": "🇸🇪",
      "discordUserId": "123456789012345678",
      "deliveryStatus": "not_sent",
      "deliveryErrorCode": null,
      "deliveryUpdatedAt": null,
      "credentialReady": true
    }
  ]
}
```

No password, token, vote, or score is returned.

### Assign a Discord representative

`PUT /editions/{editionId}/countries/{countryId}/representative`

```json
{ "discordUserId": "123456789012345678" }
```

Response: `{ "updated": true }`. Updating the mapping resets delivery status to `not_sent`.

### Generate or register a jury password

`POST /editions/{editionId}/countries/{countryId}/credential`

Generate securely on the backend:

```json
{ "mode": "generate" }
```

Response:

```json
{ "updated": true, "generatedPassword": "NXV-..." }
```

`generatedPassword` is returned exactly once. The bot should immediately DM it, overwrite the in-memory variable after use when practical, and never log it.

Register an organizer-specified password:

```json
{ "mode": "set", "password": "a-long-organizer-supplied-password" }
```

Response: `{ "updated": true }`; the password is never echoed. Passwords must be 12–256 characters. Either mode replaces the hash, increments the credential version, revokes the country's active jury session, and resets delivery status.

### Record private DM delivery outcome

`PUT /editions/{editionId}/countries/{countryId}/delivery`

Success:

```json
{ "status": "sent" }
```

Failure (never include the password or Discord error text):

```json
{ "status": "failed", "errorCode": "DM_UNAVAILABLE" }
```

Response: `{ "updated": true }`. Use a short allowlisted code such as `DM_UNAVAILABLE`, `USER_NOT_FOUND`, or `DISCORD_RATE_LIMITED`.

### Retrieve live jury statuses

`GET /editions/{editionId}/jury-statuses`

Response:

```json
{
  "editionId": "edition-2026",
  "countries": [
    {
      "countryId": "country-se",
      "code": "SE",
      "country": "Sweden",
      "status": "submitted",
      "submitted": true,
      "lastSeenAt": "2026-10-13T17:00:00.000Z"
    }
  ]
}
```

`status` is one of `offline`, `online`, `voting`, or `submitted`. Online state requires a heartbeat within 90 seconds; a prior login alone is not considered online.

### Retrieve completion status

`GET /editions/{editionId}/completion`

Response:

```json
{
  "editionId": "edition-2026",
  "completed": 8,
  "total": 12,
  "countries": [
    { "countryId": "country-se", "code": "SE", "country": "Sweden", "completed": true }
  ]
}
```

This endpoint reveals only whether a ballot exists. It never returns recipients, point values, totals, or rankings.

## Recommended bot workflow

1. Fetch the current country list and validate organizer selections against returned IDs.
2. Set representative mappings.
3. Generate one credential per mapped country (or register an organizer-provided credential).
4. DM country, voting-site URL, and password. Never post credentials in a server channel.
5. Record `sent` or `failed`. On closed DMs, report only the country and safe failure code privately to the organizer.
6. Use status/completion endpoints for organizer-only commands.
7. Rotate only the requested country credential; rotation immediately invalidates its browser session.

Retries for `GET` are safe with a new nonce. For writes, retry only after checking the resulting country state; credential generation can produce a new password on every successful call, so do not blindly retry after a network timeout.

## Secret handling checklist

- Store `BOT_API_KEY_ID` and `BOT_API_SECRET` in the bot host's secret manager.
- Never prefix/log full headers, request bodies containing passwords, or generated credential responses.
- Redact `password`, `generatedPassword`, `Authorization`, and all `X-Nexavision-*` values in HTTP logging.
- Use HTTPS only in production.
- Keep the bot and Worker clocks synchronized.
- Use separate secrets for development and production; rotate both ends together.

