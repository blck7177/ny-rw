// NYC Drift — deterministic point generator.
//
// seed (32-bit, from crypto.getRandomValues)
//   -> mulberry32 PRNG
//   -> rejection sampling inside the zone's bounding box
//   -> first point that lands inside the zone polygon.
//
// The same seed always walks the same PRNG sequence, so it always yields
// the same point. No Math.random() anywhere.
(function (root) {
  var MAX_TRIES = 100000;

  // Fresh 32-bit seed from the platform CSPRNG.
  function newSeed() {
    var buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }

  // mulberry32: small, well-known 32-bit PRNG. Returns floats in [0, 1).
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Ray casting. point and polygon vertices are [lat, lng].
  function pointInPolygon(point, polygon) {
    var y = point[0], x = point[1];
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var yi = polygon[i][0], xi = polygon[i][1];
      var yj = polygon[j][0], xj = polygon[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function bounds(polygon) {
    var b = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
    polygon.forEach(function (p) {
      if (p[0] < b.minLat) b.minLat = p[0];
      if (p[0] > b.maxLat) b.maxLat = p[0];
      if (p[1] < b.minLng) b.minLng = p[1];
      if (p[1] > b.maxLng) b.maxLng = p[1];
    });
    return b;
  }

  // Deterministic: seed -> { lat, lng, tries }.
  function pointFromSeed(seed, polygon) {
    var rand = mulberry32(seed);
    var b = bounds(polygon);
    for (var tries = 1; tries <= MAX_TRIES; tries++) {
      var lat = b.minLat + rand() * (b.maxLat - b.minLat);
      var lng = b.minLng + rand() * (b.maxLng - b.minLng);
      if (pointInPolygon([lat, lng], polygon)) {
        return { lat: lat, lng: lng, tries: tries };
      }
    }
    throw new Error("No point found for seed " + formatSeed(seed));
  }

  function seedHex(seed) {
    return ("00000000" + (seed >>> 0).toString(16).toUpperCase()).slice(-8);
  }

  function formatSeed(seed) {
    return "DRIFT-" + seedHex(seed);
  }

  // Accepts "DRIFT-1A2B3C4D", "drift 1a2b3c4d", "1A2B3C4D", "#1a2b3c4d".
  // Returns a uint32 or null.
  function parseSeed(text) {
    if (text == null) return null;
    var s = String(text).trim().toUpperCase().replace(/^DRIFT[\s\-_:]*/, "").replace(/^#/, "");
    if (!/^[0-9A-F]{1,8}$/.test(s)) return null;
    return parseInt(s, 16) >>> 0;
  }

  var Drift = {
    newSeed: newSeed,
    mulberry32: mulberry32,
    pointInPolygon: pointInPolygon,
    bounds: bounds,
    pointFromSeed: pointFromSeed,
    seedHex: seedHex,
    formatSeed: formatSeed,
    parseSeed: parseSeed,
  };

  if (typeof module === "object" && module.exports) module.exports = Drift;
  else root.Drift = Drift;
})(this);
