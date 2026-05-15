import { NextRequest, NextResponse } from 'next/server';
import { setOverrideCredentials, getFirstSheetName, resetSheetNameCache } from '@/lib/google-sheets';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/articles/test-sheet
 *
 * Test Google Sheets connection. Accepts credentials either:
 *   - From request body (sheet_id, sa_email, sa_key) — for "Test" button
 *   - From database settings — when body is empty
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sheet_id, sa_email, sa_key } = body as {
      sheet_id?: string;
      sa_email?: string;
      sa_key?: string;
    };

    // If credentials passed explicitly, use them for this request
    if (sheet_id && sa_email && sa_key) {
      setOverrideCredentials({
        sheetId: sheet_id,
        email: sa_email,
        privateKey: sa_key,
      });
    } else {
      // Try to load from database
      const db = createServerClient();
      const { data } = await db
        .from('settings')
        .select('google_sheet_id, google_sa_email, google_sa_private_key')
        .limit(1)
        .single();

      if (data?.google_sheet_id && data?.google_sa_email && data?.google_sa_private_key) {
        setOverrideCredentials({
          sheetId: data.google_sheet_id,
          email: data.google_sa_email,
          privateKey: data.google_sa_private_key,
        });
      }
      // else: will fall through to env vars in google-sheets.ts
    }

    // Reset cache and try getting sheet metadata to verify connection
    resetSheetNameCache();
    const sheetName = await getFirstSheetName();

    // Clear override after test
    setOverrideCredentials(null);

    return NextResponse.json({
      ok: true,
      message: `Kết nối thành công! Sheet: "${sheetName}"`,
    });
  } catch (err: unknown) {
    // Clear override on error too
    setOverrideCredentials(null);
    const message = err instanceof Error ? err.message : String(err);
    console.error('[test-sheet] Error:', message);
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
