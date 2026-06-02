'use client';

import { useEffect, useRef, useState } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';

export default function Home() {
  const [from, setFrom] = useState('Helsinki');
  const [to, setTo] = useState('Stockholm');
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

      <form onSubmit={search} style={{ display: 'flex', gap: 8, margin: '28px 0', alignItems: 'flex-start' }}>
        <CityInput value={from} onChange={setFrom} placeholder="From city" />
        <CityInput value={to} onChange={setTo} placeholder="To city" />
        <button type="submit" disabled={loading} style={buttonStyle}>{loading ? '…' : 'Check'}</button>
      </form>

      {result && <Result result={result} />}

      <SupportedCountries />
    </main>
  );
}

function Flag({ code, size = 18 }) {
  const F = Flags[code];
  if (!F) return <span style={{ fontSize: 11, opacity: 0.7 }}>{code}</span>;
  return <F title={code} style={{ width: size, height: size * 0.75, borderRadius: 2, verticalAlign: 'middle' }} />;
}

function CityInput({ value, onChange, placeholder }) {
  const [sugs, setSugs] = useState([]);
  const [open, setOpen] = useState(false);
  const skip = useRef(false); // don't re-query right after picking a suggestion

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    if (!value.trim()) { setSugs([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places?q=${encodeURIComponent(value)}`);
        const d = await r.json();
        setSugs(d.places || []);
      } catch { setSugs([]); }
    }, 150);
    return () => clearTimeout(t);
  }, [value]);

  function pick(name) {
    skip.current = true;
    onChange(name);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        style={inputStyle}
      />
      {open && sugs.length > 0 && (
        <ul style={dropdownStyle}>
          {sugs.map((s, i) => (
            <li key={i} onMouseDown={() => pick(s.name)} style={itemStyle}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
                {s.countries.map((c) => <Flag key={c} code={c} size={16} />)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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

function SupportedCountries() {
  const [countries, setCountries] = useState([]);
  useEffect(() => {
    fetch('/api/countries').then((r) => r.json()).then((d) => setCountries(d.countries || [])).catch(() => {});
  }, []);
  return (
    <div style={{ marginTop: 40, fontSize: 13, opacity: 0.75 }}>
      <div style={{ opacity: 0.6, marginBottom: 8 }}>Supported countries & data sources</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {countries.map((c) => (
          <li key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flag code={c.code} size={18} />
            <b>{c.name}</b>
            {c.source && (
              <span style={{ opacity: 0.7 }}>
                — <a href={c.source.url} target="_blank" rel="noreferrer" style={{ color: '#7eb0ff' }}>{c.source.label}</a>, {c.source.license}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
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

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #2a3a5a', background: '#0e1730', color: '#e7ecf5', fontSize: 15 };
const buttonStyle = { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontSize: 15, cursor: 'pointer', flexShrink: 0 };
const dropdownStyle = { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0e1730', border: '1px solid #2a3a5a', borderRadius: 8, listStyle: 'none', padding: 4, margin: 0, zIndex: 10, maxHeight: 280, overflowY: 'auto' };
const itemStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
