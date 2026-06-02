#!/usr/bin/env python3
"""Fetch the Finnish rail GTFS feed (Digitraffic) into ./gtfs/fi.

Digitraffic is open (no key) but requires a gzip Accept-Encoding and a
self-identifying Digitraffic-User header. Run: python scripts/fetch-fi.py
"""
import os, shutil, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "gtfs", "fi")
URL = "https://rata.digitraffic.fi/api/v1/trains/gtfs-passenger.zip"

tmp = os.path.join(tempfile.gettempdir(), "trains-gtfs-fi.zip")
print(f"downloading {URL}")
subprocess.run(
    ["curl", "-fsSL", "--compressed", "-H", "Digitraffic-User: Trains/fetch-script", URL, "-o", tmp],
    check=True,
)

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT, exist_ok=True)
with zipfile.ZipFile(tmp) as z:
    z.extractall(OUT)
os.remove(tmp)
print("Finland feed ->", OUT)
