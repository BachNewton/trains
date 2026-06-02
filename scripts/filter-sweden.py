#!/usr/bin/env python3
"""Stream the ~1GB GTFS Sweden 3 zip down to a slim rail-only feed in ./gtfs-se.

GTFS Sweden 3 covers every mode in the country; stop_times.txt alone is ~1GB.
We keep only rail routes (route_type 2, or extended 100-117) and the trips /
stop_times / stops / services they reference, so the app loads a small feed.
Run: python scripts/filter-sweden.py path/to/sweden.zip
"""
import csv, io, os, sys, zipfile

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/se.zip"
OUT = os.path.join(os.path.dirname(__file__), "..", "gtfs", "se")
os.makedirs(OUT, exist_ok=True)


def is_rail(rt):
    if rt == "2":
        return True
    return rt.isdigit() and 100 <= int(rt) <= 117


def reader(z, name):
    return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig", newline=""))


def open_writer(name, header):
    f = open(os.path.join(OUT, name), "w", encoding="utf-8", newline="")
    w = csv.DictWriter(f, fieldnames=header)
    w.writeheader()
    return f, w


z = zipfile.ZipFile(SRC)

# 1) rail routes
rail_routes, routes_hdr, routes_kept = set(), None, []
for row in reader(z, "routes.txt"):
    if routes_hdr is None:
        routes_hdr = list(row.keys())
    if is_rail(row["route_type"]):
        rail_routes.add(row["route_id"])
        routes_kept.append(row)
f, w = open_writer("routes.txt", routes_hdr)
w.writerows(routes_kept); f.close()
print(f"rail routes: {len(rail_routes)}")

# 2) rail trips -> collect trip ids + service ids
rail_trips, rail_services = set(), set()
trips_hdr, trips_kept = None, []
for row in reader(z, "trips.txt"):
    if trips_hdr is None:
        trips_hdr = list(row.keys())
    if row["route_id"] in rail_routes:
        rail_trips.add(row["trip_id"])
        rail_services.add(row["service_id"])
        trips_kept.append(row)
f, w = open_writer("trips.txt", trips_hdr)
w.writerows(trips_kept); f.close()
print(f"rail trips: {len(rail_trips)}  rail services: {len(rail_services)}")

# 3) stream stop_times (~1GB): keep rail trips, collect referenced stops
referenced_stops = set()
st_hdr, kept, total = None, 0, 0
src = io.TextIOWrapper(z.open("stop_times.txt"), encoding="utf-8-sig", newline="")
r = csv.DictReader(src)
fout = open(os.path.join(OUT, "stop_times.txt"), "w", encoding="utf-8", newline="")
wout = None
for row in r:
    total += 1
    if row["trip_id"] in rail_trips:
        if wout is None:
            st_hdr = list(row.keys())
            wout = csv.DictWriter(fout, fieldnames=st_hdr)
            wout.writeheader()
        wout.writerow(row)
        referenced_stops.add(row["stop_id"])
        kept += 1
fout.close()
print(f"stop_times: kept {kept} of {total} rows; referenced stops: {len(referenced_stops)}")

# 4) stops: referenced + their parent stations
stops_hdr, stops_rows = None, []
for row in reader(z, "stops.txt"):
    if stops_hdr is None:
        stops_hdr = list(row.keys())
    stops_rows.append(row)
keep_ids = set(referenced_stops)
by_id = {s["stop_id"]: s for s in stops_rows}
for sid in list(referenced_stops):
    p = by_id.get(sid, {}).get("parent_station", "")
    if p:
        keep_ids.add(p)
f, w = open_writer("stops.txt", stops_hdr)
w.writerows([s for s in stops_rows if s["stop_id"] in keep_ids]); f.close()
print(f"stops kept: {len(keep_ids)}")

# 5) calendars filtered to rail services; small files copied whole
for name in ("calendar.txt", "calendar_dates.txt"):
    if name not in z.namelist():
        continue
    hdr, rows = None, []
    for row in reader(z, name):
        if hdr is None:
            hdr = list(row.keys())
        if row["service_id"] in rail_services:
            rows.append(row)
    f, w = open_writer(name, hdr); w.writerows(rows); f.close()
    print(f"{name}: kept {len(rows)}")

for name in ("agency.txt", "feed_info.txt"):
    if name in z.namelist():
        with open(os.path.join(OUT, name), "wb") as out:
            out.write(z.read(name))

print("done ->", os.path.abspath(OUT))
