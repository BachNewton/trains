import { COUNTRIES } from '../../../lib/engine.mjs';

// GET /api/countries -> supported countries + their data sources
export async function GET() {
  return Response.json({
    countries: COUNTRIES.map((c) => ({ code: c.code, name: c.name, source: c.source })),
  });
}
