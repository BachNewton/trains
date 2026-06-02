import { route } from '../../../lib/engine.mjs';

// GET /api/route?from=Helsinki&to=Haparanda
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  if (!from || !to) {
    return Response.json({ ok: false, error: 'Provide both ?from= and ?to=' }, { status: 400 });
  }

  try {
    const result = route(from, to);
    const status = result.ok ? 200 : 400;
    return Response.json(result, { status });
  } catch (err) {
    console.error('[api] route error:', err);
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
