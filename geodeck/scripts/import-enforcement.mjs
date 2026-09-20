// Run with Node 20+: node scripts/import-enforcement.mjs [official-csv-file]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = 'https://data.gov.tw/dataset/7320';
const download = 'https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/EA5E6FCD-B82D-43B7-A5CF-E9893253187E/resource/6CDA283E-DD10-49AD-8F44-271FCB2001B4/download';
const provider = '內政部警政署';

// RFC 4180: quoted commas, embedded newlines, escaped quotes, CRLF and BOM.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else field += char;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

const localFile = process.argv[2];
let bytes;
if (localFile) bytes = await readFile(localFile);
else {
  const response = await fetch(download, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Official CSV download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
const rows = parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''));
const headers = rows.shift().map(value => value.trim());
for (const key of ['CityName', 'RegionName', 'Address', 'DeptNm', 'BranchNm', 'Longitude', 'Latitude', 'direct', 'limit']) {
  if (!headers.includes(key)) throw new Error(`Missing CSV column ${key}`);
}
const points = [], seen = new Set();
const stats = { inputRecords: 0, blankRows: 0, labelRows: 0, invalidCoordinates: 0, missingAddress: 0, duplicates: 0, retained: 0 };
for (const values of rows) {
  if (values.every(value => !value.trim())) { stats.blankRows++; continue; }
  stats.inputRecords++;
  const row = Object.fromEntries(headers.map((key, index) => [key, (values[index] ?? '').trim()]));
  if (row.Longitude === '經度' && row.Latitude === '緯度') { stats.labelRows++; continue; }
  const lat = Number(row.Latitude), lng = Number(row.Longitude);
  // Broad Taiwan + offshore-island envelope; no correction or coordinate guessing.
  if (!row.Latitude || !row.Longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 21 || lat > 27 || lng < 117 || lng > 123) {
    stats.invalidCoordinates++; continue;
  }
  if (!row.Address) { stats.missingAddress++; continue; }
  const identity = JSON.stringify([lat, lng, row.Address, row.direct, row.DeptNm]);
  const id = `npa-${createHash('sha256').update(identity).digest('hex').slice(0, 20)}`;
  if (seen.has(id)) { stats.duplicates++; continue; }
  seen.add(id);
  const limit = Number(row.limit);
  points.push({ id, lat, lng, name: [row.CityName, row.RegionName, row.Address].filter(Boolean).join(' '),
    kind: 'fixed-speed', directionText: row.direct,
    speedLimit: /^\d+(\.\d+)?$/.test(row.limit) && limit > 0 && limit <= 130 ? limit : null,
    source, provider, lastUpdated: null });
}
if (!points.length) throw new Error('No valid points; existing snapshot was not replaced');
points.sort((a, b) => a.id.localeCompare(b.id));
stats.retained = points.length;
const snapshot = { provider, source, lastUpdated: null, fetchedAt: new Date().toISOString(),
  license: '政府資料開放授權條款-第1版 (https://data.gov.tw/license)',
  download, sourceSha256: createHash('sha256').update(bytes).digest('hex'), statistics: stats, points };
const output = new URL('../data/enforcement-tw.json', import.meta.url);
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: output.pathname, ...stats }, null, 2));
