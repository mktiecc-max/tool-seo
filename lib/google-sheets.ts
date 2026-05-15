/**
 * Google Sheets API helper using Service Account JWT authentication.
 * No external packages needed — uses native crypto + fetch.
 *
 * Credentials resolution order:
 *   1. Values passed explicitly via `overrideCredentials`  (used by test-sheet API)
 *   2. Database settings table (google_sheet_id, google_sa_email, google_sa_private_key)
 *   3. Environment variables: GOOGLE_SHEET_ID, GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY
 */

import { createServerClient } from '@/lib/supabase';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ── Credential cache (avoid repeated DB lookups within the same request) ──────
let cachedCreds: { sheetId: string; email: string; key: string } | null = null;

export interface SheetCredentials {
  sheetId: string;
  email: string;
  privateKey: string;
}

/**
 * Set credentials explicitly (e.g. from test-sheet API body).
 * These take priority over DB and env vars.
 */
export function setOverrideCredentials(creds: SheetCredentials | null) {
  if (creds) {
    cachedCreds = { sheetId: creds.sheetId, email: creds.email, key: creds.privateKey };
  } else {
    cachedCreds = null;
  }
}

export async function getCredentials(): Promise<{ sheetId: string; email: string; key: string }> {
  // 1. Override (from explicit setOverrideCredentials call)
  if (cachedCreds) return cachedCreds;

  // 2. Try env vars first (fastest)
  const envSheetId = process.env.GOOGLE_SHEET_ID;
  const envEmail = process.env.GOOGLE_SA_EMAIL;
  const envKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (envSheetId && envEmail && envKey
      && !envSheetId.includes('your_') && !envEmail.includes('your-')) {
    cachedCreds = { sheetId: envSheetId, email: envEmail, key: envKey };
    return cachedCreds;
  }

  // 3. Fallback to database settings
  try {
    const db = createServerClient();
    const { data } = await db
      .from('settings')
      .select('google_sheet_id, google_sa_email, google_sa_private_key')
      .limit(1)
      .single();
    if (data?.google_sheet_id && data?.google_sa_email && data?.google_sa_private_key) {
      cachedCreds = {
        sheetId: data.google_sheet_id,
        email: data.google_sa_email,
        key: data.google_sa_private_key,
      };
      return cachedCreds;
    }
  } catch { /* ignore DB errors */ }

  throw new Error(
    'Google Sheets chưa được cấu hình. Vào Cài đặt → nhập Sheet ID, Service Account Email, và Private Key rồi bấm Lưu.'
  );
}

// ── JWT helpers ──────────────────────────────────────────────────────────────

function base64url(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signJWT(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;

  // Import PEM key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Buffer.from(pemContents, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${base64url(signature)}`;
}

async function getAccessToken(): Promise<string> {
  const creds = await getCredentials();
  // Normalize private key: handle \\n (Vercel), \r\n (Windows), and literal newlines
  const key = creds.key
    .replace(/\\n/g, '\n')   // escaped newlines from env vars
    .replace(/\r\n/g, '\n')  // Windows CRLF
    .trim();
  if (!creds.email || !key) throw new Error('GOOGLE_SA_EMAIL or GOOGLE_SA_PRIVATE_KEY missing');

  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJWT(
    { iss: creds.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    key
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || 'Failed to get access token');
  return json.access_token as string;
}

// ── Sheets API ───────────────────────────────────────────────────────────────

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function sheetsGet(range: string): Promise<string[][]> {
  const creds = await getCredentials();
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_BASE}/${creds.sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Sheets GET failed');
  return (json.values as string[][]) || [];
}

export async function sheetsAppend(range: string, values: string[][]): Promise<void> {
  const creds = await getCredentials();
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_BASE}/${creds.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error?.message || 'Sheets append failed');
  }
}

export async function sheetsUpdate(range: string, values: string[][]): Promise<void> {
  const creds = await getCredentials();
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_BASE}/${creds.sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error?.message || 'Sheets update failed');
  }
}
