import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface Params { params: { id: string } }

// GET /api/brand-kits/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('brand_kits')
      .select('*')
      .eq('id', params.id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy brand kit' }, { status: 404 });
    return NextResponse.json({ brand_kit: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// PATCH /api/brand-kits/[id] — update
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const db = createServerClient();

    // Only update provided fields
    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'description', 'brand_colors', 'logo_url',
      'writing_rules', 'tone_of_voice', 'forbidden_words',
      'target_audience', 'image_style', 'image_rules', 'guide_files',
      'brand_images',
    ];
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 });
    }

    const { data, error } = await db
      .from('brand_kits')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ brand_kit: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// DELETE /api/brand-kits/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const db = createServerClient();
    const { error } = await db.from('brand_kits').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
