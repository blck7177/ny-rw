// NYC Drift — UI.
(function () {
  "use strict";

  var ZONE = window.DRIFT_ZONE;
  var Drift = window.Drift;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Session state (memory only, never persisted).
  var state = {
    current: null, // { seed, lat, lng }
    roll: 0,
    rerolls: [], // { from, to, reason, at }
  };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    idle: $("idle"),
    result: $("result"),
    lat: $("lat"),
    lng: $("lng"),
    seed: $("seed"),
    roll: $("roll"),
    accept: $("accept"),
    log: $("log"),
    logList: $("log-list"),
    rerollModal: $("reroll-modal"),
    replayModal: $("replay-modal"),
    replayForm: $("replay-form"),
    seedInput: $("seed-input"),
    seedError: $("seed-error"),
    toast: $("toast"),
  };

  // ---------- Map ----------

  var map = null;
  var marker = null;

  function initMap() {
    if (typeof L === "undefined") return; // Leaflet failed to load; the generator still works.
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    map.attributionControl.setPrefix(false);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    var zoneLayer = L.polygon(ZONE, {
      color: "#f2efe8",
      weight: 1,
      opacity: 0.55,
      dashArray: "3 5",
      fillColor: "#f2efe8",
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(map);

    map.fitBounds(zoneLayer.getBounds(), { padding: [12, 12] });
  }

  var crosshairSvg =
    '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">' +
    '<circle class="pulse" cx="32" cy="32" r="18" fill="none" stroke="#f2efe8" stroke-width="1"/>' +
    '<circle cx="32" cy="32" r="12" fill="none" stroke="#0a0a0a" stroke-width="4"/>' +
    '<circle cx="32" cy="32" r="12" fill="none" stroke="#f2efe8" stroke-width="1.5"/>' +
    '<g stroke="#0a0a0a" stroke-width="4" stroke-linecap="square">' +
    '<line x1="32" y1="2" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="62"/>' +
    '<line x1="2" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="62" y2="32"/></g>' +
    '<g stroke="#f2efe8" stroke-width="1.5">' +
    '<line x1="32" y1="2" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="62"/>' +
    '<line x1="2" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="62" y2="32"/></g>' +
    '<rect x="30.5" y="30.5" width="3" height="3" fill="#f2efe8"/>' +
    "</svg>";

  function showOnMap(lat, lng) {
    if (!map) return;
    if (!marker) {
      marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: "crosshair", html: crosshairSvg, iconSize: [64, 64], iconAnchor: [32, 32] }),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    } else {
      marker.setLatLng([lat, lng]);
    }
    if (reduceMotion) map.setView([lat, lng], 16.5);
    else map.flyTo([lat, lng], 16.5, { duration: 1.8, easeLinearity: 0.2 });
  }

  // ---------- Generation ----------

  function fmt(n) { return n.toFixed(6); }

  function generate(seed) {
    var p = Drift.pointFromSeed(seed, ZONE);
    state.current = { seed: seed, lat: p.lat, lng: p.lng };
    state.roll += 1;
    render();
    showOnMap(p.lat, p.lng);
    updateUrl(seed);
  }

  function render() {
    var c = state.current;
    var lat = fmt(c.lat), lng = fmt(c.lng);
    els.idle.hidden = true;
    els.result.hidden = false;
    els.seed.textContent = Drift.formatSeed(c.seed);
    els.roll.textContent = String(state.roll);
    els.accept.href = appleMapsUrl(c);
    revealDigits(els.lat, lat);
    revealDigits(els.lng, lng);
  }

  // Short digit "scramble" before settling on the real value. Purely visual.
  function revealDigits(el, finalText) {
    if (reduceMotion) { el.textContent = finalText; return; }
    var frames = 14, i = 0;
    var noise = new Uint8Array(finalText.length * frames);
    crypto.getRandomValues(noise);
    clearInterval(el._timer);
    el._timer = setInterval(function () {
      i++;
      if (i >= frames) { clearInterval(el._timer); el.textContent = finalText; return; }
      var settled = Math.floor((i / frames) * finalText.length);
      var out = "";
      for (var k = 0; k < finalText.length; k++) {
        var ch = finalText[k];
        out += k < settled || !/\d/.test(ch) ? ch : String(noise[i * finalText.length + k] % 10);
      }
      el.textContent = out;
    }, 45);
  }

  function updateUrl(seed) {
    try {
      history.replaceState(null, "", "?seed=" + Drift.seedHex(seed));
    } catch (e) { /* file:// or sandboxed — ignore */ }
  }

  function shareUrl(seed) {
    return location.origin + location.pathname + "?seed=" + Drift.seedHex(seed);
  }

  function appleMapsUrl(c) {
    var ll = fmt(c.lat) + "," + fmt(c.lng);
    return "https://maps.apple.com/?daddr=" + ll + "&ll=" + ll + "&q=" + encodeURIComponent(Drift.formatSeed(c.seed));
  }

  function copyText(c) {
    return Drift.formatSeed(c.seed) + "\n" + fmt(c.lat) + ", " + fmt(c.lng);
  }

  // ---------- Actions ----------

  function randomize() {
    generate(Drift.newSeed());
  }

  function openModal(m) {
    m.hidden = false;
    var first = m.querySelector("input, button");
    if (first) first.focus({ preventScroll: true });
  }
  function closeModal(m) { m.hidden = true; }

  function reroll(reason) {
    var from = state.current.seed;
    var to = Drift.newSeed();
    state.rerolls.push({ from: from, to: to, reason: reason, at: new Date() });
    closeModal(els.rerollModal);
    generate(to);
    renderLog();
  }

  function renderLog() {
    els.log.hidden = state.rerolls.length === 0;
    els.logList.innerHTML = "";
    state.rerolls.forEach(function (r, i) {
      var li = document.createElement("li");
      var n = document.createElement("span");
      n.textContent = String(i + 1).padStart(2, "0");
      var t = document.createElement("span");
      t.textContent = Drift.formatSeed(r.from) + " — " + r.reason;
      li.appendChild(n);
      li.appendChild(t);
      els.logList.appendChild(li);
    });
  }

  function copy() {
    if (!state.current) return;
    writeClipboard(copyText(state.current)).then(
      function () { toast("COPIED"); },
      function () { toast("COPY FAILED"); }
    );
  }

  function share() {
    if (!state.current) return;
    var c = state.current;
    var url = shareUrl(c.seed);
    var text = "NYC DRIFT\n" + copyText(c);
    if (navigator.share) {
      navigator.share({ title: "NYC Drift — " + Drift.formatSeed(c.seed), text: text, url: url }).catch(function (e) {
        if (e && e.name !== "AbortError") toast("SHARE FAILED");
      });
    } else {
      writeClipboard(text + "\n" + url).then(
        function () { toast("LINK COPIED"); },
        function () { toast("SHARE UNAVAILABLE"); }
      );
    }
  }

  function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  var toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 1600);
  }

  function openReplay() {
    els.seedInput.value = state.current ? Drift.formatSeed(state.current.seed) : "";
    els.seedError.hidden = true;
    openModal(els.replayModal);
  }

  function submitReplay(e) {
    e.preventDefault();
    var seed = Drift.parseSeed(els.seedInput.value);
    if (seed === null) {
      els.seedError.hidden = false;
      return;
    }
    els.seedInput.blur();
    closeModal(els.replayModal);
    generate(seed);
  }

  // ---------- Wiring ----------

  function bind() {
    $("randomize").addEventListener("click", randomize);
    $("reroll").addEventListener("click", function () { openModal(els.rerollModal); });

    document.querySelectorAll("[data-action]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.getAttribute("data-action");
        if (a === "copy") copy();
        else if (a === "share") share();
        else if (a === "replay") openReplay();
      });
    });

    document.querySelectorAll("[data-reason]").forEach(function (b) {
      b.addEventListener("click", function () { reroll(b.getAttribute("data-reason")); });
    });

    document.querySelectorAll(".modal").forEach(function (m) {
      m.addEventListener("click", function (e) {
        if (e.target === m || e.target.hasAttribute("data-close")) closeModal(m);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") document.querySelectorAll(".modal").forEach(closeModal);
    });

    els.replayForm.addEventListener("submit", submitReplay);
    els.seedInput.addEventListener("input", function () { els.seedError.hidden = true; });
  }

  function start() {
    initMap();
    bind();
    var param = new URLSearchParams(location.search).get("seed");
    if (param !== null) {
      var seed = Drift.parseSeed(param);
      if (seed !== null) generate(seed);
      else toast("INVALID SEED IN LINK");
    }
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  start();
})();
