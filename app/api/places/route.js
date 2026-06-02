import { suggestPlaces } from '../../../lib/engine.mjs';

// GET /api/places?q=hel  -> typeahead suggestions
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  try {
    return Response.json({ places: suggestPlaces(q) });
  } catch (err) {
    console.error('[api] places error:', err);
    return Response.json({ places: [], error: String(err?.message || err) }, { status: 500 });
  }
}
