// Minimal GTFS-grade CSV parser. Handles quoted fields with embedded commas
// and doubled quotes. GTFS files don't use embedded newlines in fields, so we
// parse line-by-line for speed and low memory on the big stop_times.txt.

/** Parse one CSV line into an array of string fields. */
export function parseLine(line) {
  const out = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    if (line[i] === '"') {
      // quoted field
      let val = '';
      i++;
      while (i < n) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { val += '"'; i += 2; continue; }
          i++; break;
        }
        val += line[i++];
      }
      out.push(val);
      if (line[i] === ',') i++;
    } else {
      let j = line.indexOf(',', i);
      if (j === -1) j = n;
      out.push(line.slice(i, j));
      i = j + 1;
      if (j === n) break;
    }
  }
  return out;
}

/**
 * Parse an entire CSV file's text into an array of row objects keyed by header.
 * Strips a UTF-8 BOM if present.
 */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/);
  let h = 0;
  while (h < lines.length && lines[h].trim() === '') h++;
  const header = parseLine(lines[h]);
  const rows = [];
  for (let k = h + 1; k < lines.length; k++) {
    if (lines[k] === '') continue;
    const cells = parseLine(lines[k]);
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = cells[c];
    rows.push(obj);
  }
  return rows;
}
