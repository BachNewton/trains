#!/usr/bin/env python3
"""Fetch + rail-filter the Swedish GTFS feed (GTFS Sweden 3) into ./gtfs/se.

The national feed is ~1GB (all modes), so we download it to a temp file and
hand it to filter-sweden.py, which streams out the rail-only subset. Needs a
GTFS_SWEDEN_KEY (from the environment or .env.local).
Run: python scripts/fetch-se.py
"""
import os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_key():
    k = os.environ.get("GTFS_SWEDEN_KEY")
    if k:
        return k
    envf = os.path.join(ROOT, ".env.local")
    if os.path.exists(envf):
        for line in open(envf, encoding="utf-8"):
            line = line.strip()
            if line.startswith("GTFS_SWEDEN_KEY=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip()
    return None


key = load_key()
if not key or key.startswith("your-"):
    sys.exit("GTFS_SWEDEN_KEY not set. Add it to .env.local (see .example.env.local).")

url = f"https://opendata.samtrafiken.se/gtfs-sweden/sweden.zip?key={key}"
tmp = os.path.join(tempfile.gettempdir(), "trains-gtfs-se.zip")
print("downloading GTFS Sweden 3 (~1GB, this takes a bit)…")
subprocess.run(["curl", "-fsSL", "--compressed", url, "-o", tmp], check=True)

print("filtering to rail-only…")
subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "filter-sweden.py"), tmp], check=True)
os.remove(tmp)
print("Sweden feed ready in ./gtfs/se")
