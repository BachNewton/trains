# Trains

**The universal train routing tool.** A clean, ad-free way to answer the
questions Europe's fragmented rail sites make hard: *between two cities, is a
rail-only route even possible, and how many connections does it take?*

v1 covers **Finland + Sweden**, joined at the Tornio–Haparanda border.

## How it works

Each country is a GTFS feed loaded by an adapter into a graph of **direct-ride
edges** ("you can ride one train from X to Y without changing"). A multi-source
BFS then answers reachability, where `connections = rides - 1`. Two details do
the heavy lifting:

- **"Ever possible"** comes from the GTFS service calendar, so future-opening
  and seasonal routes count (e.g. the Helsinki–Haparanda service that opens
  2026-06-08 is found today, before any train runs on it).
- **Cross-border / same-place stations** (Finland's "Haaparanta pohjoinen" and
  Sweden's "Haparanda", ~80 m apart) are fused into one node by proximity, so a
  border crossing is one ordinary connection, not a phantom transfer.

Adding a country = one entry in `COUNTRIES` (`lib/engine.mjs`) + its `gtfs/<cc>`
feed folder.

## Setup

```bash
npm install

# 1. configure secrets
cp .example.env.local .env.local      # then add your GTFS_SWEDEN_KEY
                                       # (free, from https://www.trafiklab.se/)

# 2. fetch the rail data into ./gtfs/<cc>
npm run fetch                          # FI (open) + SE (needs the key, ~1GB download, filtered to rail)

# 3. run
npm run dev                            # http://localhost:3002
```

Run the tests: `npm test`.

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | Next.js dev server on port 3002 |
| `npm run fetch` | download + prepare both country feeds |
| `npm run fetch:fi` / `fetch:se` | one country at a time |
| `npm test` | test suite (Node's built-in runner); feed-dependent tests skip if data isn't fetched |

Data feeds live under `gtfs/` and are git-ignored — fetch them locally.

## Data & licensing

- Finland: **Fintraffic / digitraffic.fi**, CC BY 4.0.
- Sweden: **GTFS Sweden 3 via Trafiklab.se**, CC BY.
