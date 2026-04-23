import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const articleId = formData.get('article_id') as string;
    const file = formData.get('file') as File;

    if (!articleId || !file) {
      return NextResponse.json({ error: 'article_id và file bắt buộc' }, { status: 400 });
    }

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận PNG, JPG, WEBP' }, { status: 400 });
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File tối đa 5MB' }, { status: 400 });
    }

    const db = createServerClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const filename = `articles/${articleId}/upload-${Date.now()}.${file.type.split('/')[1]}`;
    const { error: uploadError } = await db.storage
      .from('images')
      .upload(filename, buffer, { contentType: file.type, upsert: true });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = db.storage.from('images').getPublicUrl(filename);
    const imageUrl = publicUrlData.publicUrl;

    await db.from('articles').update({ image_url: imageUrl, image_ai: null }).eq('id', articleId);

    return NextResponse.json({ image_url: imageUrl });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
