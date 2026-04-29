import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/brand-kits — list all brand kits
export async function GET() {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('brand_kits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ brand_kits: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// POST /api/brand-kits — create new brand kit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      brand_colors,
      logo_url,
      writing_rules,
      tone_of_voice,
      forbidden_words,
      target_audience,
      image_style,
      image_rules,
      guide_files,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Tên brand kit không được để trống' }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('brand_kits')
      .insert({
        name: name.trim(),
        description: description || null,
        brand_colors: brand_colors || [],
        logo_url: logo_url || null,
        writing_rules: writing_rules || null,
        tone_of_voice: tone_of_voice || null,
        forbidden_words: forbidden_words || [],
        target_audience: target_audience || null,
        image_style: image_style || null,
        image_rules: image_rules || null,
        guide_files: guide_files || [],
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ brand_kit: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
