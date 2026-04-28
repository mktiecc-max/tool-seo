/**
 * Google Sheets API helper using Service Account JWT authentication.
 * No external packages needed — uses native crypto + fetch.
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID           — ID from the Sheet URL (the long alphanumeric string)
 *   GOOGLE_SA_EMAIL           — Service account email (xxx@project.iam.gserviceaccount.com)
 *   GOOGLE_SA_PRIVATE_KEY     — Private key from service account JSON (include \n newlines)
 */

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ── JWT helpers ──────────────────────────────────────────────────────────────

function base64url(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let b64 = Buffer.from(bytes).toString('base64');
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
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('GOOGLE_SA_EMAIL or GOOGLE_SA_PRIVATE_KEY env var missing');

  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJWT(
    { iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
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
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID env var missing');
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Sheets GET failed');
  return (json.values as string[][]) || [];
}

export async function sheetsAppend(range: string, values: string[][]): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID env var missing');
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID env var missing');
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
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
