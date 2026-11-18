/*
  Live satellite tracker
  ----------------------
  Positions are computed in the browser from NORAD two-line element sets (TLEs):
  a two-body Kepler orbit with J2 secular perturbations (node regression and
  apsidal rotation) and the TLE's mean-motion rate. That is accurate to roughly
  tens of kilometers within a few days of the element epoch.

  Orbit data is loaded in this order:
    1. data/tle.txt in this repo (refreshed by the GitHub Action in .github/workflows)
    2. a cached copy in this browser, if under 6 hours old
    3. live sources: CelesTrak, then the TLE API, then wheretheiss.at (ISS only)
    4. any older copy up to 14 days old, marked as approximate
*/
(function (root) {
  "use strict";

  /* ======================= Orbit math ======================= */
  var MU = 398600.4418;            // km^3/s^2
  var RE = 6378.137;               // km, WGS-84 equatorial radius
  var J2 = 1.08262668e-3;
  var FLAT = 1 / 298.257223563;
  var E2 = FLAT * (2 - FLAT);
  var D2R = Math.PI / 180, R2D = 180 / Math.PI, TWO_PI = 2 * Math.PI;
  var DAY_MS = 864e5;

  function wrap360(d) { return ((d % 360) + 360) % 360; }
  function wrap180(d) { d = wrap360(d); return d > 180 ? d - 360 : d; }

  /* Parse a TLE into a propagatable orbit. Returns null if it doesn't look valid. */
  function makeOrbit(l1, l2) {
    try {
      l1 = String(l1).replace(/\s+$/, ""); l2 = String(l2).trim();
      if (l1.charAt(0) !== "1" || l2.charAt(0) !== "2") return null;
      var id = parseInt(l1.substring(2, 7), 10);
      var epochStr = l1.substring(18, 32), ndotStr = l1.substring(33, 43);
      if (!/^\s*\d{5}\.\d+\s*$/.test(epochStr)) {        // not fixed-width: fall back to fields
        var f = l1.split(/\s+/);
        var ei = f.findIndex(function (x) { return /^\d{5}\.\d+$/.test(x); });
        if (ei < 0) return null;
        epochStr = f[ei]; ndotStr = f[ei + 1] || "0";
      }
      epochStr = epochStr.trim();
      var yy = parseInt(epochStr.substring(0, 2), 10);
      var day = parseFloat(epochStr.substring(2));
      var year = yy < 57 ? 2000 + yy : 1900 + yy;
      var epoch = Date.UTC(year, 0, 1) + (day - 1) * DAY_MS;
      var ndot2 = parseFloat(ndotStr.trim().replace(/^([+-]?)\./, "$10.")) || 0;   // (dn/dt)/2, rev/day^2

      var t = l2.split(/\s+/);
      var mm = (t[7] || "").match(/^\d{1,2}\.\d{1,8}/);
      if (!mm) return null;
      var o = {
        id: id, epoch: epoch, ndot2: ndot2,
        incl: parseFloat(t[2]) * D2R,
        raan0: parseFloat(t[3]) * D2R,
        ecc: parseFloat("0." + t[4]),
        argp0: parseFloat(t[5]) * D2R,
        M0: parseFloat(t[6]) * D2R,
        revPerDay: parseFloat(mm[0])
      };
      if (!(o.revPerDay > 0.5 && o.revPerDay < 20) || !(o.ecc >= 0 && o.ecc < 0.9) || isNaN(epoch)) return null;
      o.n = o.revPerDay * TWO_PI / 86400;                      // rad/s
      o.a = Math.cbrt(MU / (o.n * o.n));                       // km
      var p = o.a * (1 - o.ecc * o.ecc);
      var k = 1.5 * J2 * Math.pow(RE / p, 2) * o.n;
      var ci = Math.cos(o.incl);
      o.raanDot = -k * ci;                                     // rad/s
      o.argpDot = 0.5 * k * (5 * ci * ci - 1);                 // rad/s
      return o;
    } catch (e) { return null; }
  }

  /* Earth-centered inertial position (km) and speed (km/s) at time tMs. */
  function propagate(o, tMs) {
    var dt = (tMs - o.epoch) / 1000, dd = dt / 86400;
    var M = o.M0 + o.n * dt + TWO_PI * o.ndot2 * dd * dd;
    var e = o.ecc;
    var E = M;
    for (var i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    var nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    var r = o.a * (1 - e * Math.cos(E));
    var raan = o.raan0 + o.raanDot * dt;
    var u = o.argp0 + o.argpDot * dt + nu;
    var cO = Math.cos(raan), sO = Math.sin(raan), cu = Math.cos(u), su = Math.sin(u);
    var ci = Math.cos(o.incl), si = Math.sin(o.incl);
    return {
      x: r * (cO * cu - sO * su * ci),
      y: r * (sO * cu + cO * su * ci),
      z: r * (su * si),
      speed: Math.sqrt(MU * (2 / r - 1 / o.a))
    };
  }

  /* Greenwich mean sidereal time (radians), IAU 1982 model. */
  function gmst(tMs) {
    var jd = tMs / DAY_MS + 2440587.5;
    var T = (jd - 2451545.0) / 36525;
    var sec = 67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T * T * T;
    return wrap360(sec / 240) * D2R;
  }

  function toEcef(p, tMs) {
    var th = gmst(tMs), c = Math.cos(th), s = Math.sin(th);
    return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c, z: p.z };
  }

  /* Geodetic latitude/longitude (deg) and altitude (km) on the WGS-84 ellipsoid. */
  function geodetic(ecef) {
    var x = ecef.x, y = ecef.y, z = ecef.z;
    var lon = Math.atan2(y, x);
    var pxy = Math.sqrt(x * x + y * y);
    var lat = Math.atan2(z, pxy * (1 - E2)), h = 0;
    for (var i = 0; i < 6; i++) {
      var sl = Math.sin(lat);
      var N = RE / Math.sqrt(1 - E2 * sl * sl);
      h = pxy / Math.cos(lat) - N;
      lat = Math.atan2(z, pxy * (1 - E2 * N / (N + h)));
    }
    return { lat: lat * R2D, lon: wrap180(lon * R2D), alt: h };
  }

  function observerEcef(st) {
    var la = st.lat * D2R, lo = st.lon * D2R, sl = Math.sin(la);
    var N = RE / Math.sqrt(1 - E2 * sl * sl);
    return {
      x: (N + st.alt) * Math.cos(la) * Math.cos(lo),
      y: (N + st.alt) * Math.cos(la) * Math.sin(lo),
      z: (N * (1 - E2) + st.alt) * sl
    };
  }

  /* Azimuth/elevation (deg) and range (km) of a satellite from a ground station. */
  function lookAngles(ecef, st, obs) {
    obs = obs || observerEcef(st);
    var dx = ecef.x - obs.x, dy = ecef.y - obs.y, dz = ecef.z - obs.z;
    var la = st.lat * D2R, lo = st.lon * D2R;
    var sla = Math.sin(la), cla = Math.cos(la), slo = Math.sin(lo), clo = Math.cos(lo);
    var e = -slo * dx + clo * dy;
    var n = -sla * clo * dx - sla * slo * dy + cla * dz;
    var u = cla * clo * dx + cla * slo * dy + sla * dz;
    var rng = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { az: wrap360(Math.atan2(e, n) * R2D), el: Math.asin(Math.max(-1, Math.min(1, u / rng))) * R2D, range: rng };
  }

  /* Sub-solar point (deg), low-precision Astronomical Almanac formulas. */
  function subsolar(tMs) {
    var n = tMs / DAY_MS + 2440587.5 - 2451545.0;
    var L = wrap360(280.460 + 0.9856474 * n);
    var g = wrap360(357.528 + 0.9856003 * n) * D2R;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    var eps = (23.439 - 0.0000004 * n) * D2R;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    return { lat: dec * R2D, lon: wrap180((ra - gmst(tMs)) * R2D) };
  }

  function satState(o, tMs) {
    var p = propagate(o, tMs);
    var ecef = toEcef(p, tMs);
    var g = geodetic(ecef);
    g.speed = p.speed; g.ecef = ecef;
    return g;
  }

  /* Parse a block of TLE text (with or without name lines) into {id: {l1, l2, name}}. */
  function parseTleText(txt) {
    var lines = String(txt).split(/\r?\n/).map(function (s) { return s.replace(/\s+$/, ""); }).filter(Boolean);
    var out = {};
    for (var i = 0; i < lines.length - 1; i++) {
      if (/^1 /.test(lines[i]) && /^2 /.test(lines[i + 1])) {
        var id = parseInt(lines[i].substring(2, 7), 10);
        var prev = i > 0 ? lines[i - 1] : "";
        out[id] = { l1: lines[i], l2: lines[i + 1], name: /^[12] /.test(prev) ? "" : prev.trim() };
        i++;
      }
    }
    return out;
  }

  var Orbit = {
    makeOrbit: makeOrbit, propagate: propagate, gmst: gmst, toEcef: toEcef, geodetic: geodetic,
    observerEcef: observerEcef, lookAngles: lookAngles, subsolar: subsolar, satState: satState,
    parseTleText: parseTleText
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Orbit;
  if (typeof document === "undefined" || !document.getElementById("map")) return;

  /* ======================= Tracker UI ======================= */
  var SATS = [
    { id: 25544, label: "ISS", name: "International Space Station",
      note: "Crewed laboratory operated by NASA, Roscosmos, ESA, JAXA, and CSA." },
    { id: 20580, label: "Hubble", name: "Hubble Space Telescope",
      note: "NASA and ESA space telescope, in orbit since 1990." },
    { id: 57166, label: "Meteor-M2 3", name: "Meteor-M2 3",
      note: "Russian polar-orbiting weather satellite. It sends LRPT images near 137 MHz, the band my ground station receives." },
    { id: 59051, label: "Meteor-M2 4", name: "Meteor-M2 4",
      note: "Russian polar-orbiting weather satellite that also broadcasts LRPT images near 137 MHz." }
  ];
  var STATION = { name: "Albuquerque", lat: 35.0844, lon: -106.6198, alt: 1.6 };
  var OBS = observerEcef(STATION);
  var W = 1000, H = 500;
  var SVGNS = "http://www.w3.org/2000/svg";
  var CACHE_KEY = "bw-tracker-tle-v1";
  var HOUR = 36e5;

  var state = { orbits: {}, meta: {}, selected: SATS[0].id, pass: null, lastTrack: 0 };

  function $(id) { return document.getElementById(id); }
  function X(lon) { return (lon + 180) / 360 * W; }
  function Y(lat) { return (90 - lat) / 180 * H; }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function f1(v) { return v.toFixed(1); }

  /* ---------- Paths that may cross the date line ---------- */
  function unwrap(lons) {
    var out = [lons[0]];
    for (var i = 1; i < lons.length; i++) {
      var d = lons[i] - lons[i - 1];
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      out.push(out[i - 1] + d);
    }
    return out;
  }
  // pts: [[lon, lat], ...] with continuous (unwrapped) longitudes. Draws every
  // 360-degree copy that lands on the map, so lines and areas wrap cleanly.
  function wrappedPath(pts, closed) {
    if (pts.length < 2) return "";
    var min = Infinity, max = -Infinity;
    pts.forEach(function (p) { if (p[0] < min) min = p[0]; if (p[0] > max) max = p[0]; });
    var d = "";
    for (var k = -3; k <= 3; k++) {
      var off = k * 360;
      if (min + off > 180 || max + off < -180) continue;
      d += "M" + pts.map(function (p) { return f1(X(p[0] + off)) + "," + f1(Y(p[1])); }).join("L") + (closed ? "Z" : "");
    }
    return d;
  }

  /* ---------- Static map layers ---------- */
  function drawGrid() {
    var g = $("map-grid");
    for (var lon = -150; lon <= 150; lon += 30) el("line", { x1: X(lon), y1: 0, x2: X(lon), y2: H }, g);
    for (var lat = -60; lat <= 60; lat += 30) el("line", { x1: 0, y1: Y(lat), x2: W, y2: Y(lat) }, g);
    var s = $("map-station");
    var x = X(STATION.lon), y = Y(STATION.lat);
    el("rect", { "class": "station", x: x - 5, y: y - 5, width: 10, height: 10, transform: "rotate(45 " + x + " " + y + ")" }, s);
    var t = el("text", { "class": "station-label", x: x - 10, y: y + 20, "text-anchor": "end" }, s);
    t.textContent = STATION.name;
  }

  function topoRings(topo) {
    var tr = topo.transform;
    var arcs = topo.arcs.map(function (arc) {
      var x = 0, y = 0;
      return arc.map(function (p) {
        if (tr) { x += p[0]; y += p[1]; return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]; }
        return [p[0], p[1]];
      });
    });
    function arcPts(i) { return i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); }
    function ring(idx) {
      var pts = [];
      idx.forEach(function (i, k) { arcPts(i).forEach(function (p, j) { if (k === 0 || j > 0) pts.push(p); }); });
      return pts;
    }
    var rings = [];
    function geom(g) {
      if (!g) return;
      if (g.type === "GeometryCollection") g.geometries.forEach(geom);
      else if (g.type === "Polygon") g.arcs.forEach(function (r) { rings.push(ring(r)); });
      else if (g.type === "MultiPolygon") g.arcs.forEach(function (poly) { poly.forEach(function (r) { rings.push(ring(r)); }); });
    }
    Object.keys(topo.objects).forEach(function (k) { geom(topo.objects[k]); });
    return rings;
  }

  function loadLand() {
    var urls = [
      "data/land-110m.json",
      "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json",
      "https://unpkg.com/world-atlas@2/land-110m.json"
    ];
    (function next(i) {
      if (i >= urls.length) return;
      fetchTimeout(urls[i], 8000)
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (topo) {
          var d = topoRings(topo).map(function (r) {
            return "M" + r.map(function (p) { return f1(X(p[0])) + "," + f1(Y(p[1])); }).join("L") + "Z";
          }).join("");
          $("map-land").setAttribute("d", d);
        })
        .catch(function () { next(i + 1); });
    })(0);
  }

  /* ---------- Night side ---------- */
  function drawNight(tMs) {
    var s = subsolar(tMs);
    var dec = Math.abs(s.lat) < 0.1 ? (s.lat < 0 ? -0.1 : 0.1) : s.lat;
    var tanDec = Math.tan(dec * D2R);
    var pts = [];
    for (var lon = -180; lon <= 180; lon += 2) {
      var H0 = (lon - s.lon) * D2R;
      pts.push([lon, Math.atan(-Math.cos(H0) / tanDec) * R2D]);
    }
    var poleLat = dec > 0 ? -90 : 90;     // the pole tilted away from the sun is in darkness
    var d = "M" + X(-180) + "," + Y(poleLat) + pts.map(function (p) { return "L" + f1(X(p[0])) + "," + f1(Y(p[1])); }).join("") +
            "L" + X(180) + "," + Y(poleLat) + "Z";
    $("map-night").setAttribute("d", d);
  }

  /* ---------- Satellite layers ---------- */
  function drawTrack(o, tMs) {
    var past = [], next = [], lons = [], lats = [], times = [];
    for (var t = tMs - 50 * 60e3; t <= tMs + 95 * 60e3; t += 20e3) {
      var g = satState(o, t);
      lons.push(g.lon); lats.push(g.lat); times.push(t);
    }
    var u = unwrap(lons);
    for (var i = 0; i < u.length; i++) {
      var p = [u[i], lats[i]];
      if (times[i] <= tMs) past.push(p);
      if (times[i] >= tMs - 20e3) next.push(p);
    }
    $("map-track-past").setAttribute("d", wrappedPath(past, false));
    $("map-track-next").setAttribute("d", wrappedPath(next, false));
  }

  function drawFootprint(g) {
    var lam = Math.acos(RE / (RE + g.alt));
    var la = g.lat * D2R, lo = g.lon * D2R, pts = [];
    for (var b = 0; b <= 360; b += 4) {
      var br = b * D2R;
      var lat2 = Math.asin(Math.sin(la) * Math.cos(lam) + Math.cos(la) * Math.sin(lam) * Math.cos(br));
      var lon2 = lo + Math.atan2(Math.sin(br) * Math.sin(lam) * Math.cos(la), Math.cos(lam) - Math.sin(la) * Math.sin(lat2));
      pts.push([lon2 * R2D, lat2 * R2D]);
    }
    var u = unwrap(pts.map(function (p) { return p[0]; }));
    var ring = u.map(function (lon, i) { return [lon, pts[i][1]]; });
    var span = u[u.length - 1] - u[0];
    if (Math.abs(span) > 180) {                 // footprint covers a pole: close it along the pole
      var pole = g.lat > 0 ? 90 : -90;
      ring.push([u[u.length - 1], pole], [u[0], pole]);
    }
    $("map-footprint").setAttribute("d", wrappedPath(ring, true));
  }

  function drawMarkers(tMs) {
    var others = $("map-others");
    while (others.firstChild) others.removeChild(others.firstChild);
    var selG = $("map-sat");
    while (selG.firstChild) selG.removeChild(selG.firstChild);
    var placed = [];                      // label boxes already drawn, to avoid overlaps
    SATS.slice().sort(function (a, b) { return (b.id === state.selected) - (a.id === state.selected); })
      .forEach(function (s) {
        var o = state.orbits[s.id];
        if (!o) return;
        var g = satState(o, tMs);
        var x = X(g.lon), y = Y(g.lat), right = x < W - 130;
        var isSel = s.id === state.selected;
        var parent = isSel ? selG : others;
        el("circle", { "class": isSel ? "sat" : "other", cx: f1(x), cy: f1(y), r: isSel ? 7 : 4.5 }, parent);
        var lx = right ? x + 11 : x - 11, ly = y + (isSel ? -10 : 4);
        var bx = right ? lx : lx - 90;
        for (var tries = 0; tries < 4 && placed.some(function (p) { return Math.abs(p[0] - bx) < 90 && Math.abs(p[1] - ly) < 15; }); tries++) ly += 15;
        placed.push([bx, ly]);
        var t = el("text", {
          "class": isSel ? "sat-label" : "other-label",
          x: f1(lx), y: f1(ly), "text-anchor": right ? "start" : "end"
        }, parent);
        t.textContent = s.label;
      });
  }

  /* ---------- Albuquerque passes ---------- */
  function elevation(o, t) { return lookAngles(satState(o, t).ecef, STATION, OBS).el; }

  function refine(o, a, b) {        // a and b straddle the horizon
    var ea = elevation(o, a) > 0;
    for (var i = 0; i < 14; i++) {
      var m = (a + b) / 2;
      if ((elevation(o, m) > 0) === ea) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  function findPass(o, now) {
    var STEP = 30e3, t;
    if (elevation(o, now) > 0) {
      t = now; while (elevation(o, t) > 0 && t - now < 3 * HOUR) t += STEP;
      var los = refine(o, t - STEP, t);
      t = now; while (elevation(o, t) > 0 && now - t < 3 * HOUR) t -= STEP;
      return buildPass(o, refine(o, t, t + STEP), los);
    }
    for (t = now; t - now < 48 * HOUR; t += STEP) {
      if (elevation(o, t + STEP) > 0) {
        var aos = refine(o, t, t + STEP), u = t + STEP;
        while (elevation(o, u) > 0 && u - aos < 3 * HOUR) u += STEP;
        return buildPass(o, aos, refine(o, u - STEP, u));
      }
    }
    return null;
  }

  function buildPass(o, aos, los) {
    var pts = [], maxEl = -90, maxT = aos;
    for (var t = aos; t <= los; t += 10e3) {
      var la = lookAngles(satState(o, t).ecef, STATION, OBS);
      pts.push(la);
      if (la.el > maxEl) { maxEl = la.el; maxT = t; }
    }
    pts.push(lookAngles(satState(o, los).ecef, STATION, OBS));
    return { aos: aos, los: los, maxEl: maxEl, maxT: maxT, pts: pts, satId: o.id };
  }

  /* ---------- Sky plot of the pass ---------- */
  var SKY_C = 100, SKY_R = 88;
  function skyXY(az, elv) {
    var r = SKY_R * (90 - Math.max(0, elv)) / 90, a = az * D2R;
    return [SKY_C + r * Math.sin(a), SKY_C - r * Math.cos(a)];
  }
  function drawSkyGrid() {
    var g = $("sky-grid");
    [0, 30, 60].forEach(function (e) {
      el("circle", { cx: SKY_C, cy: SKY_C, r: SKY_R * (90 - e) / 90, "class": e === 0 ? "ring ring-outer" : "ring" }, g);
    });
    for (var az = 0; az < 360; az += 45) {
      var p = skyXY(az, 0);
      el("line", { x1: SKY_C, y1: SKY_C, x2: p[0], y2: p[1], "class": "spoke" }, g);
    }
    [["N", 0], ["E", 90], ["S", 180], ["W", 270]].forEach(function (c) {
      var r = SKY_R + 12, a = c[1] * D2R;
      var t = el("text", { x: SKY_C + r * Math.sin(a), y: SKY_C - r * Math.cos(a), "class": "compass",
        "text-anchor": "middle", "dominant-baseline": "central" }, g);
      t.textContent = c[0];
    });
    [30, 60].forEach(function (e) {
      var t = el("text", { x: SKY_C + 3, y: SKY_C - SKY_R * (90 - e) / 90 - 3, "class": "el-label" }, g);
      t.textContent = e + "°";
    });
  }
  function drawSkyPass(pass) {
    var path = $("sky-pass"), aos = $("sky-aos");
    if (!pass) { path.setAttribute("d", ""); aos.setAttribute("cx", -99); return; }
    path.setAttribute("d", "M" + pass.pts.map(function (p) { return skyXY(p.az, p.el).map(f1).join(","); }).join("L"));
    var a = skyXY(pass.pts[0].az, 0);
    aos.setAttribute("cx", f1(a[0])); aos.setAttribute("cy", f1(a[1]));
  }

  /* ---------- Readout ---------- */
  var COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  function dir(az) { return COMPASS[Math.round(az / 45) % 8]; }
  function latStr(v) { return Math.abs(v).toFixed(2) + "° " + (v >= 0 ? "N" : "S"); }
  function lonStr(v) { return Math.abs(v).toFixed(2) + "° " + (v >= 0 ? "E" : "W"); }
  var timeFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  var shortTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  var dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  function dur(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + " h " + m + " min";
    if (m >= 10) return m + " min";
    if (m > 0) return m + " min " + String(sec).padStart(2, "0") + " s";
    return sec + " s";
  }

  function updateReadout(tMs) {
    var sat = SATS.filter(function (s) { return s.id === state.selected; })[0];
    $("ro-name").textContent = sat.name;
    $("ro-note").textContent = sat.note;
    var o = state.orbits[sat.id];
    if (!o) {
      ["ro-lat", "ro-lon", "ro-alt", "ro-spd"].forEach(function (k) { $(k).textContent = "—"; });
      $("ro-pass").textContent = state.loaded ? "Orbit data for this satellite isn’t available right now." : "Loading orbit data…";
      drawSkyPass(null); $("sky-now").setAttribute("cx", -99);
      return;
    }
    var g = satState(o, tMs);
    $("ro-lat").textContent = latStr(g.lat);
    $("ro-lon").textContent = lonStr(g.lon);
    $("ro-alt").textContent = Math.round(g.alt).toLocaleString() + " km";
    $("ro-spd").textContent = g.speed.toFixed(2) + " km/s";

    var p = state.pass;
    if (!p || p.satId !== o.id || tMs > p.los || (tMs >= p.aos && !p.live)) {
      p = state.pass = findPass(o, tMs);
      if (p) p.live = tMs >= p.aos;
      drawSkyPass(p);
    }
    var now = $("sky-now"), txt = $("ro-pass");
    if (!p) {
      txt.textContent = "No pass over Albuquerque in the next 48 hours.";
      now.setAttribute("cx", -99);
    } else if (tMs >= p.aos) {
      var la = lookAngles(g.ecef, STATION, OBS);
      var xy = skyXY(la.az, la.el);
      now.setAttribute("cx", f1(xy[0])); now.setAttribute("cy", f1(xy[1]));
      txt.innerHTML = "Above the horizon now: <strong>" + Math.round(la.el) + "°</strong> high in the " + dir(la.az) +
        ". Sets in <strong>" + dur(p.los - tMs) + "</strong>.";
    } else {
      now.setAttribute("cx", -99);
      txt.innerHTML = "Next pass <strong>" + timeFmt.format(new Date(p.aos)) + "</strong>, in " + dur(p.aos - tMs) +
        ". Rises in the " + dir(p.pts[0].az) + " and reaches <strong>" + Math.round(p.maxEl) + "°</strong> at " +
        shortTime.format(new Date(p.maxT)) + ".";
    }
  }

  /* ---------- Loop ---------- */
  function tick(force) {
    if (document.hidden && !force) return;
    var t = Date.now();
    var o = state.orbits[state.selected];
    if (force || t - state.lastTrack > 20e3) {
      drawNight(t);
      if (o) drawTrack(o, t); else { $("map-track-past").setAttribute("d", ""); $("map-track-next").setAttribute("d", ""); }
      state.lastTrack = t;
    }
    if (o) drawFootprint(satState(o, t)); else $("map-footprint").setAttribute("d", "");
    drawMarkers(t);
    updateReadout(t);
  }

  function select(id) {
    state.selected = id; state.pass = null;
    Array.prototype.forEach.call($("sat-picker").children, function (b) {
      b.setAttribute("aria-pressed", String(+b.getAttribute("data-id") === id));
    });
    tick(true);
  }

  function buildPicker() {
    var box = $("sat-picker");
    SATS.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = s.label;
      b.setAttribute("data-id", s.id);
      b.setAttribute("aria-pressed", String(s.id === state.selected));
      b.addEventListener("click", function () { select(s.id); });
      box.appendChild(b);
    });
  }

  /* ---------- Orbit data loading ---------- */
  function fetchTimeout(url, ms) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(timer); return r; },
      function (e) { clearTimeout(timer); throw e; });
  }
  function ageDays(rec) { var o = makeOrbit(rec.l1, rec.l2); return o ? (Date.now() - o.epoch) / DAY_MS : Infinity; }
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; } }
  function writeCache(c) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* storage unavailable */ } }

  var LIVE = [
    { name: "CelesTrak", url: function (id) { return "https://celestrak.org/NORAD/elements/gp.php?CATNR=" + id + "&FORMAT=TLE"; },
      read: function (r, id) { return r.text().then(function (t) { return parseTleText(t)[id]; }); } },
    { name: "TLE API", url: function (id) { return "https://tle.ivanstanojevic.me/api/tle/" + id; },
      read: function (r) { return r.json().then(function (j) { return { l1: j.line1, l2: j.line2 }; }); } },
    { name: "wheretheiss.at", url: function (id) { return id === 25544 ? "https://api.wheretheiss.at/v1/satellites/25544/tles" : null; },
      read: function (r) { return r.json().then(function (j) { return { l1: j.line1, l2: j.line2 }; }); } }
  ];

  function fetchLive(id) {
    return (function next(i) {
      if (i >= LIVE.length) return Promise.resolve(null);
      var url = LIVE[i].url(id);
      if (!url) return next(i + 1);
      return fetchTimeout(url, 7000)
        .then(function (r) { if (!r.ok) throw 0; return LIVE[i].read(r, id); })
        .then(function (rec) {
          if (rec && makeOrbit(rec.l1, rec.l2) && ageDays(rec) < 14) { rec.source = LIVE[i].name; return rec; }
          throw 0;
        })
        .catch(function () { return next(i + 1); });
    })(0);
  }

  function loadOrbits() {
    var repo = fetchTimeout("data/tle.txt", 6000)
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(parseTleText)
      .catch(function () { return {}; });

    return repo.then(function (repoTles) {
      var cache = readCache();
      return Promise.all(SATS.map(function (s) {
        var fromRepo = repoTles[s.id], cached = cache[s.id];
        if (fromRepo && ageDays(fromRepo) <= 3) { fromRepo.source = "CelesTrak"; return fromRepo; }
        if (cached && Date.now() - cached.fetched < 6 * HOUR && ageDays(cached) <= 3) return cached;
        return fetchLive(s.id).then(function (rec) {
          if (rec) { rec.fetched = Date.now(); cache[s.id] = rec; return rec; }
          // Nothing fresh: fall back to the newest older copy, if it's within two weeks.
          var olds = [fromRepo && Object.assign({ source: "CelesTrak" }, fromRepo), cached].filter(function (x) { return x && ageDays(x) < 14; });
          olds.sort(function (a, b) { return ageDays(a) - ageDays(b); });
          if (olds[0]) olds[0].stale = true;
          return olds[0] || null;
        });
      })).then(function (recs) { writeCache(cache); return recs; });
    });
  }

  function applyOrbits(recs) {
    state.loaded = true;
    var sources = {}, newest = 0, stale = [], missing = [];
    recs.forEach(function (rec, i) {
      var s = SATS[i];
      var o = rec && makeOrbit(rec.l1, rec.l2);
      var btn = $("sat-picker").children[i];
      if (!o) { missing.push(s.label); btn.disabled = true; return; }
      state.orbits[s.id] = o;
      sources[rec.source || "CelesTrak"] = 1;
      newest = Math.max(newest, o.epoch);
      if (rec.stale) stale.push(s.label + " (" + Math.round(ageDays(rec)) + " days)");
    });

    if (!state.orbits[state.selected]) {
      var first = SATS.filter(function (s) { return state.orbits[s.id]; })[0];
      if (first) state.selected = first.id;
    }
    var status = $("tracker-status");
    if (!newest) {
      status.textContent = "Orbit data couldn’t be loaded right now, so positions can’t be shown. Refresh the page to try again.";
    } else {
      var msg = "Orbit data from " + Object.keys(sources).join(" and ") + ", newest element set " +
        dateFmt.format(new Date(newest)) + ". Positions update every second using a two-body orbit model with J2 perturbations.";
      if (stale.length) msg += " Live data was unavailable for " + stale.join(", ") + ", so those positions are approximate.";
      if (missing.length) msg += " No data for " + missing.join(", ") + ".";
      status.textContent = msg;
    }
    select(state.selected);
  }

  /* ---------- Start ---------- */
  buildPicker();
  drawGrid();
  drawSkyGrid();
  loadLand();
  tick(true);
  loadOrbits().then(applyOrbits);
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(true); });
  root.BWTracker = Orbit;
})(typeof window !== "undefined" ? window : this);
