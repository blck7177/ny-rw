// Run: node tests/drift.test.js   (Node 18+, no dependencies)
"use strict";
const assert = require("assert");
const Drift = require("../js/drift.js");
const ZONE = require("../js/zone.js");

// Pinned outputs. If these change, previously shared seeds point elsewhere.
const PINNED = [
  "DRIFT-00000000 40.721167, -74.008036",
  "DRIFT-1A2B3C4D 40.723916, -73.973099",
  "DRIFT-FFFFFFFF 40.780763, -73.977646",
  "DRIFT-DEADBEEF 40.773749, -73.991643",
];

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("ok  -", name);
}

test("point-in-polygon: square and concave shapes", () => {
  const sq = [[0, 0], [0, 10], [10, 10], [10, 0]];
  assert.ok(Drift.pointInPolygon([5, 5], sq));
  assert.ok(!Drift.pointInPolygon([15, 5], sq));
  assert.ok(!Drift.pointInPolygon([-1, -1], sq));
  // U shape: notch between x 3..7 above y 3
  const u = [[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10]];
  assert.ok(Drift.pointInPolygon([1, 5], u.map(([x, y]) => [y, x])));
  assert.ok(!Drift.pointInPolygon([5, 5], u.map(([x, y]) => [y, x])));
  assert.ok(Drift.pointInPolygon([2, 5], u.map(([x, y]) => [y, x])));
});

test("zone: known places in / out", () => {
  const inside = {
    "Empire State Building": [40.748440, -73.985664],
    "Washington Square Park": [40.730823, -73.997332],
    "Central Park Great Lawn": [40.781200, -73.966500],
    "Wall St / Broad St": [40.706900, -74.011000],
    "Tompkins Square Park": [40.726500, -73.981700],
    "Columbus Circle": [40.768100, -73.981900],
    "Carl Schurz Park": [40.775000, -73.944000],
  };
  const outside = {
    "Harlem, 125th St": [40.807500, -73.946000],
    "Columbia University (116th)": [40.807700, -73.962600],
    "DUMBO, Brooklyn": [40.703300, -73.988100],
    "Jersey City": [40.717800, -74.043100],
    "Roosevelt Island": [40.761000, -73.950000],
    "Governors Island": [40.689500, -74.016800],
    "Long Island City": [40.744700, -73.948500],
    "Hudson River": [40.760000, -74.012000],
    "East River": [40.735000, -73.965000],
    "Statue of Liberty": [40.689200, -74.044500],
    "Randalls Island": [40.793000, -73.921000],
  };
  for (const [k, p] of Object.entries(inside)) assert.ok(Drift.pointInPolygon(p, ZONE), k + " should be inside");
  for (const [k, p] of Object.entries(outside)) assert.ok(!Drift.pointInPolygon(p, ZONE), k + " should be outside");
});

test("10,000 random seeds all land inside the zone", () => {
  const b = Drift.bounds(ZONE);
  for (let i = 0; i < 10000; i++) {
    const p = Drift.pointFromSeed(Drift.newSeed(), ZONE);
    assert.ok(Drift.pointInPolygon([p.lat, p.lng], ZONE));
    assert.ok(p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng);
  }
});

test("same seed -> same coordinate (every time)", () => {
  for (let i = 0; i < 500; i++) {
    const s = Drift.newSeed();
    const a = Drift.pointFromSeed(s, ZONE);
    const b = Drift.pointFromSeed(s, ZONE);
    const c = Drift.pointFromSeed(Drift.parseSeed(Drift.formatSeed(s)), ZONE);
    assert.deepStrictEqual(a, b);
    assert.deepStrictEqual(a, c);
  }
  // Pinned values: these must never change, or old shared links break.
  const pinned = [0x00000000, 0x1a2b3c4d, 0xffffffff, 0xdeadbeef].map((s) => {
    const p = Drift.pointFromSeed(s, ZONE);
    return Drift.formatSeed(s) + " " + p.lat.toFixed(6) + ", " + p.lng.toFixed(6);
  });
  console.log("      " + pinned.join("\n      "));
  assert.deepStrictEqual(pinned, PINNED);
});

test("different seeds spread across the whole zone", () => {
  const N = 20000;
  const b = Drift.bounds(ZONE);
  const GRID = 12; // ~0.7 km x 0.6 km cells
  const cellOf = (lat, lng) =>
    Math.min(GRID - 1, Math.floor(((lat - b.minLat) / (b.maxLat - b.minLat)) * GRID)) * GRID +
    Math.min(GRID - 1, Math.floor(((lng - b.minLng) / (b.maxLng - b.minLng)) * GRID));
  const hits = new Map();
  const seen = new Set();
  let south = 0; // below 14th St-ish
  for (let i = 0; i < N; i++) {
    const p = Drift.pointFromSeed(Drift.newSeed(), ZONE);
    seen.add(p.lat.toFixed(6) + p.lng.toFixed(6));
    const c = cellOf(p.lat, p.lng);
    hits.set(c, (hits.get(c) || 0) + 1);
    if (p.lat < 40.735) south++;
  }
  assert.ok(seen.size > N * 0.999, "points should be essentially unique");
  // Every grid cell whose centre is well inside the zone should be hit.
  let checked = 0;
  for (let r = 0; r < GRID; r++) {
    for (let col = 0; col < GRID; col++) {
      const lat = b.minLat + ((r + 0.5) / GRID) * (b.maxLat - b.minLat);
      const lng = b.minLng + ((col + 0.5) / GRID) * (b.maxLng - b.minLng);
      if (Drift.pointInPolygon([lat, lng], ZONE)) {
        checked++;
        assert.ok((hits.get(r * GRID + col) || 0) > 20, "cell " + r + "," + col + " under-sampled");
      }
    }
  }
  // Monte Carlo estimate of the area share south of 40.735, compared with samples.
  let inZone = 0, inSouth = 0;
  const rand = Drift.mulberry32(12345);
  while (inZone < 200000) {
    const lat = b.minLat + rand() * (b.maxLat - b.minLat);
    const lng = b.minLng + rand() * (b.maxLng - b.minLng);
    if (Drift.pointInPolygon([lat, lng], ZONE)) { inZone++; if (lat < 40.735) inSouth++; }
  }
  const expected = inSouth / inZone, got = south / N;
  console.log("      cells checked: " + checked + ", south share expected " + expected.toFixed(3) + " got " + got.toFixed(3));
  assert.ok(Math.abs(expected - got) < 0.02);
});

test("seed parsing and formatting", () => {
  assert.strictEqual(Drift.formatSeed(0x1a2b3c4d), "DRIFT-1A2B3C4D");
  assert.strictEqual(Drift.formatSeed(0xff), "DRIFT-000000FF");
  assert.strictEqual(Drift.parseSeed("DRIFT-1A2B3C4D"), 0x1a2b3c4d);
  assert.strictEqual(Drift.parseSeed("drift-1a2b3c4d"), 0x1a2b3c4d);
  assert.strictEqual(Drift.parseSeed("  1A2B3C4D "), 0x1a2b3c4d);
  assert.strictEqual(Drift.parseSeed("DRIFT 1a2b3c4d"), 0x1a2b3c4d);
  assert.strictEqual(Drift.parseSeed("FFFFFFFF"), 0xffffffff);
  assert.strictEqual(Drift.parseSeed("ff"), 0xff);
  assert.strictEqual(Drift.parseSeed(""), null);
  assert.strictEqual(Drift.parseSeed("DRIFT-"), null);
  assert.strictEqual(Drift.parseSeed("123456789"), null);
  assert.strictEqual(Drift.parseSeed("XYZ"), null);
  assert.strictEqual(Drift.parseSeed(null), null);
});

test("newSeed uses crypto and returns uint32", () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const s = Drift.newSeed();
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff);
    seen.add(s);
  }
  assert.ok(seen.size > 990);
});

console.log("\n" + passed + " tests passed");
