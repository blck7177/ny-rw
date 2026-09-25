# NYC Drift

A random urban wandering game. Press one button and get a truly random coordinate in
Manhattan south of 96th Street. Go to the nearest legally accessible public pedestrian
spot near it, then wander for 30–60 minutes.

Static site: plain HTML/CSS/JS, Leaflet + OpenStreetMap tiles. No backend, no database, no API keys.

## V1 rule

> The generator chooses a point inside the Manhattan drift zone south of 96th St. If the exact
> pin is inside a building, restricted property, construction, or another location that cannot
> legally be reached, begin from the nearest public pedestrian point. Do not reroll because a
> place looks boring.

Rerolls ask for a reason (inaccessible, private/restricted, construction/closure, on-site
safety veto). "Boring" is deliberately not an option. Reasons are kept in memory for the
current session only.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | The single page |
| `styles.css` | Monochrome, mobile-first styles |
| `js/zone.js` | Playable polygon (`[lat, lng]` vertices) |
| `js/drift.js` | Seed, PRNG, point-in-polygon, rejection sampling. No DOM, so Node can run it too |
| `js/app.js` | UI: map, buttons, modals, share/copy, `?seed=` handling |
| `sw.js` | Service worker: caches the app shell for offline use |
| `manifest.webmanifest`, `icons/` | Home Screen / PWA metadata and monochrome icons |
| `vendor/leaflet/` | Leaflet 1.9.4 (BSD-2), vendored so it works offline |
| `tests/drift.test.js` | Generator tests: `node tests/drift.test.js` |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

Every asset path is relative (`js/app.js`, not `/js/app.js`), so the site works from a
project subdirectory such as `https://USERNAME.github.io/nyc-drift/`.

## How randomness and seeds work

1. `crypto.getRandomValues()` makes a 32-bit seed. `Math.random()` is never used.
2. The seed starts a deterministic PRNG (mulberry32).
3. Rejection sampling: draw latitude and longitude uniformly inside the zone's bounding box,
   keep the point if it is inside the polygon, otherwise draw again.
4. The seed is shown as `DRIFT-1A2B3C4D` (8 hex digits).

Because steps 2–3 depend only on the seed and the polygon, the same seed always gives the
same point. Links like `?seed=1A2B3C4D` recreate it, and so does **REPLAY SEED**, which accepts
`DRIFT-1A2B3C4D` or `1A2B3C4D`.
Changing the polygon or the algorithm would move old seeds, so the tests pin a few known outputs.

Sampling is uniform in latitude/longitude degrees. Over this small area that is uniform by
ground area to within about 0.1%.

## The boundary is approximate

The playable zone is **an approximate game boundary, not an official, legal, or cadastral
boundary.** It is built from the NYC Department of City Planning borough boundary (water-clipped
shoreline): only the main Manhattan island polygon, cut along a straight line that follows 96th
Street (the Broadway/96th and Lexington/96th subway stations, extended to both rivers), then
simplified to about 350 vertices (~15 m tolerance). It excludes Roosevelt, Governors,
Randalls/Wards, Liberty and Ellis Islands. Near the shoreline, a pier, or the 96th St edge,
a point may land slightly on the wrong side. Use on-site judgment.

## Offline

After one online visit, the service worker caches the app shell, so the generator, seeds, copy
and replay all work without a connection. **Map tiles are not cached.** The map will be blank
offline, apart from any tiles the browser happened to keep.

## Deploy on GitHub Pages

1. Push this repository to GitHub with these files at the root of the `main` branch.
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main`, folder `/ (root)`, and click **Save**.
5. Wait a minute, then open `https://USERNAME.github.io/REPO-NAME/`.
   (Name the repo `nyc-drift` to get `https://USERNAME.github.io/nyc-drift/`.)

### Install on iPhone

Open the site in Safari → Share → **Add to Home Screen**.
**ACCEPT FATE** opens Apple Maps with directions to the exact coordinate.

## Local development

```sh
python3 -m http.server 8000     # then open http://localhost:8000/
node tests/drift.test.js        # generator tests
```

Service workers need `http://localhost` or HTTPS. They do not run from `file://`.
After changing any cached file, bump `CACHE` in `sw.js` so installed copies update.

Map data © OpenStreetMap contributors. Use the tiles lightly, following the
[OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
