/**
 * Community post image upload. Proxies multipart to engine POST /api/community/posts/:id/image.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = String(id || '').trim();
    if (!postId) {
      return NextResponse.json({ error: 'post_id_required' }, { status: 400 });
    }

    const incoming = await req.formData();
    const file = incoming.get('image');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'image_required' }, { status: 400 });
    }

    const outbound = new FormData();
    const name = file instanceof File && file.name ? file.name : 'image.jpg';
    outbound.append('image', file, name);
    outbound.append('userId', userId);

    const base = getEngineBaseUrl();
    const r = await fetch(
      `${base}/api/community/posts/${encodeURIComponent(postId)}/image?userId=${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        headers: engineProxyHeaders(),
        body: outbound,
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e) {
    console.error('[api/community/posts/image] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Image upload failed' },
      { status: 502 }
    );
  }
}
