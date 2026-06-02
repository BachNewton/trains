'use client';

import { useState } from 'react';

export default function Home() {
  const [from, setFrom] = useState('Helsinki');
  const [to, setTo] = useState('Haparanda');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setResult(await res.json());
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 20px' }}>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Trains</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>The universal train routing tool — is it possible by rail?</p>

      <form onSubmit={search} style={{ display: 'flex', gap: 8, margin: '28px 0', flexWrap: 'wrap' }}>
        <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From city"
          style={inputStyle} />
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To city"
          style={inputStyle} />
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? '…' : 'Check'}
        </button>
      </form>

      {result && <Result result={result} />}

      <p style={{ opacity: 0.4, fontSize: 13, marginTop: 40 }}>
        v1 — Finland only (Sweden next). Data: Fintraffic / digitraffic.fi, CC BY 4.0.
      </p>
    </main>
  );
}

function Result({ result }) {
  if (!result.ok) return <Card tone="#3a1c2a">⚠️ {result.error}</Card>;
  if (!result.possible) {
    return <Card tone="#3a1c2a">❌ No rail route found from <b>{result.from}</b> to <b>{result.to}</b>.</Card>;
  }
  const conn = result.connections;
  return (
    <Card tone="#16243f">
      <div style={{ fontSize: 20, marginBottom: 10 }}>
        ✅ Possible — <b>{conn === 0 ? 'direct, no connections' : `${conn} connection${conn > 1 ? 's' : ''}`}</b>
      </div>
      <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        {result.rides.map((r, i) => (
          <li key={i}>
            <b>{r.from}</b> → <b>{r.to}</b>
            {r.approxMinutes != null && <span style={{ opacity: 0.6 }}> · ~{fmtDur(r.approxMinutes)}</span>}
            {r.runs?.start && <span style={{ opacity: 0.5, fontSize: 13 }}> · runs {fmtDate(r.runs.start)}–{fmtDate(r.runs.end)}</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Card({ children, tone }) {
  return <div style={{ background: tone, border: '1px solid #2a3a5a', borderRadius: 12, padding: 20 }}>{children}</div>;
}

function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtDate(s) {
  if (!s || s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const inputStyle = { flex: 1, minWidth: 140, padding: '10px 12px', borderRadius: 8, border: '1px solid #2a3a5a', background: '#0e1730', color: '#e7ecf5', fontSize: 15 };
const buttonStyle = { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontSize: 15, cursor: 'pointer' };
