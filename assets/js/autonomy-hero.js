/* Autonomy in Surgical Robotics — research hero animation.
   Canvas port of the Claude Design "SurgicalAutonomy" scene (captions + HUD
   off, as used in the hero): a software-projected 3D tissue mound drawn as
   halftone dots, two surgical instruments that Perceive → Explore → Manipulate
   → Share control on a 32 s loop. Authored on a 1920×1080 stage that is
   scaled to fit its box. Pauses off-screen / in background tabs; shows a
   single still frame under prefers-reduced-motion. */
(function () {
  'use strict';
  var canvas = document.getElementById('autonomy-hero');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentNode;
  var dither = stage.querySelector('.ah-stage__dither');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Stage + palette ─────────────────────────────────────────────────────────
  var W = 1920, H = 1080, FOC = 1250, CX = W * 0.57, CY = H * 0.47;
  var YEL = '#F8CD04', INK = '#0A0A0A', G3 = '#C2C2C2', G4 = '#9A9A9A';
  var LABEL_FONT = '600 20px Raleway, sans-serif';

  // Scene cues (running sum of the authored scene durations).
  var P = 0, E = 8, M = 17.6, S = 25.6, END = 32;
  var STILL_T = M + 3.9; // representative frame for reduced motion

  // ── Maths ──────────────────────────────────────────────────────────────────
  var Easing = {
    easeOutCubic: function (t) { return (--t) * t * t + 1; },
    easeInOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    easeInOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  };
  var MOVE = Easing.easeInOutCubic, ENTER = Easing.easeOutCubic, FADE = Easing.easeInOutSine;
  function cl(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return v < a ? a : v > b ? b : v; }
  function rp(T, a, b, e) { return (e || FADE)(cl((T - a) / (b - a))); }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function nrm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function keys(K, T, e) {
    e = e || MOVE;
    var L = Array.isArray(K[0][1]) ? lerp3 : lerp;
    if (T <= K[0][0]) return K[0][1];
    for (var i = 0; i < K.length - 1; i++) {
      var t0 = K[i][0], a = K[i][1], t1 = K[i + 1][0], b = K[i + 1][1];
      if (T <= t1) return L(a, b, e(cl((T - t0) / (t1 - t0 || 1))));
    }
    return K[K.length - 1][1];
  }

  // ── Tissue: soft organ-like mound sampled on a grid ─────────────────────────
  var NX = 72, NZ = 50, RX = 1.45, RZ = 1.0, N = NX * NZ;
  function hBase(x, z) {
    var r2 = x * x / (RX * RX) + z * z / (RZ * RZ);
    var ef = cl(1 - r2 * r2 * r2);
    return ef * (0.30 * Math.exp(-(x * x / 1.1 + z * z / 0.45)) +
      0.10 * Math.exp(-(Math.pow(x - 0.45, 2) + Math.pow(z + 0.15, 2)) / 0.1) +
      0.03 * Math.sin(4 * x + 1) * Math.cos(3.2 * z) + 0.04);
  }
  var GX_ = new Float32Array(N), GZ_ = new Float32Array(N), GH = new Float32Array(N), INSIDE = new Uint8Array(N);
  (function () {
    for (var i = 0; i < NX; i++) for (var j = 0; j < NZ; j++) {
      var k = i * NZ + j, xx = -RX + (2 * RX * i) / (NX - 1), zz = -RZ + (2 * RZ * j) / (NZ - 1);
      GX_[k] = xx; GZ_[k] = zz; GH[k] = hBase(xx, zz);
      INSIDE[k] = xx * xx / (RX * RX) + zz * zz / (RZ * RZ) < 0.985 ? 1 : 0;
    }
  })();
  var STC = [0.12, 0.02];
  function stiff(x, z) { return Math.exp(-(Math.pow(x - STC[0], 2) + Math.pow(z - STC[1], 2)) / 0.05); }
  var LIGHT = nrm([-0.5, 0.9, 0.6]);

  // ── Choreography constants (world) ──────────────────────────────────────────
  var PROBES = [[-0.62, 0.22], [-0.12, 0.3], [0.14, 0.0], [0.52, 0.34]];
  var GX = 0.46, GZ = -0.16, GP = [GX, hBase(GX, GZ), GZ], GD = [0.24, 0.34, -0.04];
  var DIR_A = nrm([-0.75, 0.9, 0.22]), DIR_B = nrm([0.75, 0.9, 0.16]);
  var HOVER_A = [-0.85, 0.62, 0.22], HOVER_A2 = [-0.95, 0.58, 0.28], HOVER_B = [0.95, 0.62, 0.08];
  var PROBE_T = PROBES.map(function (_, k) { return E + 0.5 + k * 2.0; });
  var KA = (function () {
    var K = [[E, HOVER_A]];
    PROBES.forEach(function (c, k) {
      var s = PROBE_T[k], hb = hBase(c[0], c[1]);
      var depth = 0.11 * (1 - 0.78 * stiff(c[0], c[1]));
      var above = [c[0], hb + 0.18, c[1]], down = [c[0], hb - depth, c[1]];
      K.push([s + 0.6, above], [s + 1.0, down], [s + 1.25, down], [s + 1.65, above]);
    });
    K.push([E + 9.2, HOVER_A2]);
    return K;
  })();
  var G_ABOVE = add(GP, [0, 0.17, 0]), G_GOAL = add(GP, GD);
  var KB = [[M, HOVER_B], [M + 1.3, G_ABOVE], [M + 1.9, add(GP, [0, 0.004, 0])], [M + 2.5, GP],
    [M + 6.2, G_GOAL], [S + 0.9, G_GOAL], [S + 2.2, add(G_GOAL, [0.2, 0.22, 0.02])]];
  var KJAW = [[M + 0.5, 0.12], [M + 1.3, 0.55], [M + 1.9, 0.55], [M + 2.3, 0.02],
    [S + 0.6, 0.02], [S + 1.0, 0.55], [S + 2.0, 0.55], [S + 2.6, 0.12]];
  var KTARGET = [[0, [0, 0.08, 0]], [E - 1, [0, 0.08, 0]], [E + 1.5, [-0.1, 0.1, 0.12]], [M - 0.5, [-0.05, 0.1, 0.1]],
    [M + 1.5, [0.2, 0.15, -0.05]], [S + 0.5, [0.2, 0.15, -0.05]], [S + 4.5, [0, 0.08, 0]]];
  var KDIST = [[0, 4.7], [E, 4.15], [E + 2, 3.8], [M, 3.75], [M + 2, 3.5], [S + 0.5, 3.5], [S + 5, 4.7]];

  function hull(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i, q;
    for (i = 0; i < p.length; i++) { q = p[i]; while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (i = p.length - 1; i >= 0; i--) { q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  function poly(c, pts, close) {
    for (var i = 0; i < pts.length; i++) { if (i) c.lineTo(pts[i][0], pts[i][1]); else c.moveTo(pts[i][0], pts[i][1]); }
    if (close) c.closePath();
  }

  // ── Canvas plumbing ────────────────────────────────────────────────────────
  // Group opacity (SVG <g opacity>) is composited through an offscreen layer so
  // overlapping shapes fade as one, exactly like the original.
  var layer = document.createElement('canvas'), lctx = layer.getContext('2d');
  var scale = 1, offX = 0, offY = 0;
  function stageTransform(c) { c.setTransform(scale, 0, 0, scale, offX, offY); }
  function group(op, draw) {
    if (op <= 0.001) return;
    if (op >= 0.999) { draw(ctx); return; }
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, layer.width, layer.height);
    stageTransform(lctx);
    draw(lctx);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = op;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  function label(c, text, x, y, color) {
    c.font = LABEL_FONT;
    if ('letterSpacing' in c) c.letterSpacing = '3.2px';
    c.fillStyle = color;
    c.textBaseline = 'alphabetic';
    c.fillText(text, x, y);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }

  // ── Instruments ────────────────────────────────────────────────────────────
  function drawTool(c, tip, dir, jaw, cam, proj) {
    var a = nrm(cross(dir, [0, 0, 1])), b = cross(dir, a);
    function at(d) { return add(tip, mul(dir, d)); }
    function ring(cen, r, n) {
      n = n || 16;
      var out = [];
      for (var k = 0; k < n; k++) {
        var t = (k / n) * Math.PI * 2, o = add(mul(a, Math.cos(t)), mul(b, Math.sin(t)));
        out.push({ p: add(cen, mul(o, r)), o: o });
      }
      return out;
    }
    function frontArc(cen, r) {
      var R = ring(cen, r, 24), toC = sub(cam, cen);
      for (var k = 0; k < R.length; k++) {
        var A = R[k], B = R[(k + 1) % R.length];
        if (dot(A.o, toC) > 0 && dot(B.o, toC) > 0) {
          var pa = proj(A.p), pb = proj(B.p);
          c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]);
        }
      }
    }
    function cyl(d0, d1, r) {
      return hull(ring(at(d0), r).concat(ring(at(d1), r)).map(function (q) { return proj(q.p); }));
    }
    var shaft = cyl(0.27, 2.6, 0.05), wrist = cyl(0.12, 0.28, 0.034);
    var P0 = at(0.13), toCam = nrm(sub(cam, at(0.3))), side = nrm(cross(dir, toCam));
    var oh = nrm(add(mul(toCam, 0.75), mul(side, -0.66)));
    var hl = [proj(add(at(0.3), mul(oh, 0.05))), proj(add(at(2.6), mul(oh, 0.05)))];
    var jaws = [1, -1].map(function (s) {
      var jd = nrm(add(mul(dir, -Math.cos(jaw)), mul(a, s * Math.sin(jaw))));
      var tj = add(P0, mul(jd, 0.135));
      return [add(P0, mul(b, 0.017)), add(tj, mul(b, 0.005)), add(tj, mul(b, -0.005)), add(P0, mul(b, -0.017))].map(proj);
    });
    var pv = proj(P0);

    c.lineJoin = 'round';
    c.fillStyle = INK; c.strokeStyle = '#fff';
    function solid(pts, w) { c.beginPath(); poly(c, pts, true); c.fill(); c.lineWidth = w; c.stroke(); }
    solid(jaws[0], 1.8); solid(jaws[1], 1.8);
    solid(wrist, 1.8);
    solid(shaft, 2);
    c.beginPath();
    [0.29, 0.33, 0.5, 0.56].forEach(function (d) { frontArc(at(d), 0.05); });
    frontArc(at(0.2), 0.034);
    c.globalAlpha = 0.8; c.lineWidth = 1.3; c.stroke();
    c.beginPath(); poly(c, hl, false);
    c.globalAlpha = 0.45; c.lineWidth = 1.2; c.stroke();
    c.globalAlpha = 1;
    c.beginPath(); c.arc(pv[0], pv[1], 5, 0, Math.PI * 2);
    c.fillStyle = INK; c.fill(); c.lineWidth = 1.5; c.stroke();
    c.lineJoin = 'miter';
  }

  function drawPose(c, tip, dir, jaw, proj, text) {
    var a = nrm(cross(dir, [0, 0, 1])), b = cross(dir, a);
    var P0 = add(tip, mul(dir, 0.13));
    var jt = [1, -1].map(function (s) {
      return add(P0, mul(nrm(add(mul(dir, -Math.cos(jaw)), mul(a, s * Math.sin(jaw)))), 0.135));
    });
    var kp = [jt[0], P0, jt[1], add(tip, mul(dir, 0.28)), add(tip, mul(dir, 0.6))].map(proj);
    var xs = kp.map(function (p) { return p[0]; }), ys = kp.map(function (p) { return p[1]; });
    var pad = 30, L = 20;
    var x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad;
    var y0 = Math.min.apply(null, ys) - pad, y1 = Math.max.apply(null, ys) + pad;

    // corner brackets
    c.beginPath();
    c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0);
    c.moveTo(x1 - L, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + L);
    c.moveTo(x1, y1 - L); c.lineTo(x1, y1); c.lineTo(x1 - L, y1);
    c.moveTo(x0 + L, y1); c.lineTo(x0, y1); c.lineTo(x0, y1 - L);
    c.strokeStyle = '#fff'; c.globalAlpha = 0.7; c.lineWidth = 1.5; c.stroke();
    // keypoint skeleton
    c.beginPath(); poly(c, [kp[0], kp[1], kp[2]], false); poly(c, [kp[1], kp[3], kp[4]], false);
    c.strokeStyle = YEL; c.globalAlpha = 0.8; c.stroke();
    c.globalAlpha = 1;
    // pose axes
    var pv = kp[1];
    [[dir, '#fff'], [a, YEL], [b, G4]].forEach(function (ax) {
      var p = proj(add(P0, mul(ax[0], 0.13)));
      c.beginPath(); c.moveTo(pv[0], pv[1]); c.lineTo(p[0], p[1]);
      c.strokeStyle = ax[1]; c.lineWidth = 2.2; c.stroke();
    });
    // keypoints
    c.lineWidth = 2; c.strokeStyle = YEL;
    kp.forEach(function (p, i) {
      c.fillStyle = i === 1 ? YEL : INK;
      c.fillRect(p[0] - 6, p[1] - 6, 12, 12);
      c.strokeRect(p[0] - 6, p[1] - 6, 12, 12);
    });
    label(c, text, x0, y0 - 14, G3);
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  var PX = new Float32Array(N), PY = new Float32Array(N), PZ = new Float32Array(N);
  var DOT_X = new Float32Array(N), DOT_Y = new Float32Array(N), DOT_KEY = new Uint8Array(N);
  // bucket key = colour index * 32 + level; colours sorted d < w < y like the original
  var COLS = ['d', 'w', 'y'];
  var BUCKET_ORDER = (function () {
    var names = [];
    for (var ci = 0; ci < 3; ci++) for (var lv = 1; lv <= 22; lv++) names.push({ name: COLS[ci] + lv, key: ci * 32 + lv });
    names.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    return names.map(function (n) { return n.key; });
  })();

  function renderScene(T) {
    // Camera
    var target = keys(KTARGET, T), dist = keys(KDIST, T);
    var az = -0.12 + 0.34 * Math.sin((2 * Math.PI * T) / END);
    var el = 0.6 + 0.05 * Math.sin((4 * Math.PI * T) / END);
    var cam = add(target, mul([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], dist));
    var fw = nrm(sub(target, cam)), rt = nrm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
    function proj(p) {
      var vx = p[0] - cam[0], vy = p[1] - cam[1], vz = p[2] - cam[2];
      var z = Math.max(0.05, vx * fw[0] + vy * fw[1] + vz * fw[2]);
      return [CX + (FOC * (vx * rt[0] + vy * rt[1] + vz * rt[2])) / z, CY - (FOC * (vx * up[0] + vy * up[1] + vz * up[2])) / z, z];
    }

    // Instrument 1: explores by probing
    var inA = rp(T, P + 3.0, P + 5.0, ENTER), outTools = rp(T, S + 2.4, S + 4.4, MOVE);
    var tipA = add(keys(KA, T), mul(DIR_A, 1.7 * (1 - inA) + 1.7 * outTools));
    var penA = Math.max(0, hBase(tipA[0], tipA[2]) - tipA[1]);

    // Instrument 2: grasps and retracts tissue toward a target
    var inB = rp(T, P + 3.3, P + 5.3, ENTER);
    var tipB = add(keys(KB, T), mul(DIR_B, 1.7 * (1 - inB) + 1.7 * outTools));
    var jawB = keys(KJAW, T), jawA = 0.03;
    var attach = 0, gd = [0, 0, 0];
    if (T >= M + 2.3 && T < S + 0.75) { attach = rp(T, M + 2.3, M + 2.5); gd = sub(tipB, GP); }
    else if (T >= S + 0.75) { var tau = T - (S + 0.75); attach = Math.exp(-3.6 * tau) * Math.cos(11 * tau); gd = GD; }

    // Tissue state
    var sweepP = rp(T, P + 0.3, P + 4.3, FADE);
    var sweep = lerp(-1.7, 1.7, sweepP);
    var tissueOp = 1 - rp(T, S + 4.3, S + 6.1);
    var reveal = PROBE_T.map(function (s) { return rp(T, s + 1.0, s + 2.2); });
    var stiffK = 1 - 0.45 * rp(T, M, M + 1.5);
    var k, x, z;
    for (k = 0; k < N; k++) {
      x = GX_[k]; z = GZ_[k];
      var px = x, py = GH[k], pz = z;
      if (penA > 0) py -= penA * Math.exp(-(Math.pow(x - tipA[0], 2) + Math.pow(z - tipA[2], 2)) / 0.045);
      if (attach !== 0) {
        var w = Math.exp(-(Math.pow(x - GX, 2) + Math.pow(z - GZ, 2)) / 0.16) * attach;
        px += gd[0] * w; py += gd[1] * w; pz += gd[2] * w;
      }
      PX[k] = px; PY[k] = py; PZ[k] = pz;
    }

    // Halftone dots: shade from the deformed surface normal, size by depth
    var nd = 0, i, j;
    for (i = 0; i < NX; i++) for (j = 0; j < NZ; j++) {
      k = i * NZ + j;
      if (!INSIDE[k]) continue;
      x = GX_[k]; z = GZ_[k];
      if (x > sweep) continue;
      var i0 = Math.max(0, i - 1) * NZ + j, i1 = Math.min(NX - 1, i + 1) * NZ + j;
      var j0 = i * NZ + Math.max(0, j - 1), j1 = i * NZ + Math.min(NZ - 1, j + 1);
      var dux = PX[i1] - PX[i0], duy = PY[i1] - PY[i0], duz = PZ[i1] - PZ[i0];
      var dvx = PX[j1] - PX[j0], dvy = PY[j1] - PY[j0], dvz = PZ[j1] - PZ[j0];
      // n = normalize(cross(dv, du))
      var nx = dvy * duz - dvz * duy, ny = dvz * dux - dvx * duz, nz = dvx * duy - dvy * dux;
      var nl = Math.hypot(nx, ny, nz) || 1;
      var shade = cl(((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl) * 1.1 - 0.05);
      var vx = PX[k] - cam[0], vy = PY[k] - cam[1], vz = PZ[k] - cam[2];
      var dz = Math.max(0.05, vx * fw[0] + vy * fw[1] + vz * fw[2]);
      var sx = CX + (FOC * (vx * rt[0] + vy * rt[1] + vz * rt[2])) / dz;
      var sy = CY - (FOC * (vx * up[0] + vy * up[1] + vz * up[2])) / dz;
      var size = (0.9 + 7.4 * Math.pow(shade, 1.8)) * (3.4 / dz);
      var lvl = Math.max(1, Math.min(22, Math.round(size * 2)));
      var col = 1; // w
      if (sweep - x < 0.14 && sweepP < 1) col = 2;
      else {
        var ex = 0;
        for (var q = 0; q < PROBES.length; q++) if (reveal[q] > 0) {
          ex = Math.max(ex, reveal[q] * Math.exp(-(Math.pow(x - PROBES[q][0], 2) + Math.pow(z - PROBES[q][1], 2)) / 0.09));
        }
        var sd = stiff(x, z) * ex * stiffK;
        if (sd > 0.42) col = 2; else if (sd > 0.18) col = 0;
      }
      DOT_X[nd] = sx; DOT_Y[nd] = sy; DOT_KEY[nd] = col * 32 + lvl; nd++;
    }

    // ── Tissue group: dots, multiscale mesh, probe markers
    group(tissueOp, function (c) {
      c.lineCap = 'round';
      for (var b = 0; b < BUCKET_ORDER.length; b++) {
        var key = BUCKET_ORDER[b], any = false;
        c.beginPath();
        for (var d = 0; d < nd; d++) if (DOT_KEY[d] === key) {
          c.moveTo(DOT_X[d], DOT_Y[d]); c.lineTo(DOT_X[d] + 0.01, DOT_Y[d]); any = true;
        }
        if (!any) continue;
        var ci = (key / 32) | 0, lv = key % 32;
        c.strokeStyle = ci === 1 ? '#fff' : YEL;
        c.globalAlpha = ci === 0 ? 0.55 : ci === 1 ? 0.92 : 1;
        c.lineWidth = lv / 2;
        c.stroke();
      }
      c.globalAlpha = 1;
      c.lineCap = 'butt';

      // Multiscale mesh (manipulation)
      var meshIn = [rp(T, M + 0.3, M + 1.2), rp(T, M + 2.4, M + 3.4), rp(T, M + 3.4, M + 4.4)];
      var meshOut = 1 - rp(T, S + 1.2, S + 2.6);
      if (meshOut > 0 && meshIn[0] > 0) {
        c.lineJoin = 'round';
        var gridD = function (step, rad) {
          c.beginPath();
          var ok = function (kk) {
            return INSIDE[kk] && (!rad || Math.pow(GX_[kk] - GX, 2) + Math.pow(GZ_[kk] - GZ, 2) < rad * rad);
          };
          var run = function (ks) {
            var seg = [];
            var flush = function () { if (seg.length > 1) poly(c, seg, false); seg = []; };
            for (var r = 0; r < ks.length; r++) {
              var kk = ks[r];
              if (ok(kk)) seg.push(proj([PX[kk], PY[kk], PZ[kk]])); else flush();
            }
            flush();
          };
          var ii, jj, ks;
          for (ii = 0; ii < NX; ii += step) { ks = []; for (jj = 0; jj < NZ; jj++) ks.push(ii * NZ + jj); run(ks); }
          for (jj = 0; jj < NZ; jj += step) { ks = []; for (ii = 0; ii < NX; ii++) ks.push(ii * NZ + jj); run(ks); }
        };
        gridD(8, 0);
        c.strokeStyle = '#fff'; c.globalAlpha = 0.3 * meshIn[0] * meshOut; c.lineWidth = 1.2; c.stroke();
        if (meshIn[1] > 0) {
          gridD(4, 0.8);
          c.globalAlpha = 0.45 * meshIn[1] * meshOut; c.lineWidth = 1.1; c.stroke();
        }
        if (meshIn[2] > 0) {
          gridD(2, 0.42);
          c.strokeStyle = YEL; c.globalAlpha = 0.8 * meshIn[2] * meshOut; c.lineWidth = 1.1; c.stroke();
        }
        c.globalAlpha = 1;
        c.lineJoin = 'miter';
      }

      // Probe sample markers
      var markOp = 1 - rp(T, M + 0.2, M + 1.4);
      if (markOp > 0) {
        c.strokeStyle = YEL; c.lineWidth = 2;
        PROBES.forEach(function (pc, qi) {
          if (reveal[qi] <= 0) return;
          var r = 0.03 + 0.085 * ENTER(reveal[qi]), pts = [];
          for (var s = 0; s < 28; s++) {
            var t = (s / 28) * Math.PI * 2, mx = pc[0] + r * Math.cos(t), mz = pc[1] + r * Math.sin(t);
            pts.push(proj([mx, hBase(mx, mz) + 0.004, mz]));
          }
          c.beginPath(); poly(c, pts, true);
          c.globalAlpha = markOp * (0.5 + 0.5 * (1 - reveal[qi]));
          c.stroke();
        });
        c.globalAlpha = 1;
      }
    });

    // ── Scan sheet (perception)
    if (sweepP > 0 && sweepP < 1) {
      group(Math.sin(Math.PI * sweepP), function (c) {
        var crv = [];
        for (var zz = -1.05; zz <= 1.05; zz += 0.03) {
          if (sweep * sweep / (RX * RX) + zz * zz / (RZ * RZ) < 1) crv.push(proj([sweep, hBase(sweep, zz), zz]));
        }
        var sheet = [[sweep, -0.02, -1.1], [sweep, 0.62, -1.1], [sweep, 0.62, 1.1], [sweep, -0.02, 1.1]].map(proj);
        c.beginPath(); poly(c, sheet, true);
        c.fillStyle = YEL; c.globalAlpha = 0.05; c.fill();
        c.strokeStyle = YEL; c.globalAlpha = 0.35; c.lineWidth = 1.2; c.stroke();
        c.globalAlpha = 1;
        if (crv.length > 1) { c.beginPath(); poly(c, crv, false); c.lineWidth = 2.5; c.stroke(); }
      });
    }

    // ── Target (manipulation goal)
    var tgtOp = rp(T, M + 0.8, M + 1.4) * (1 - rp(T, S + 0.4, S + 1.2));
    if (tgtOp > 0) {
      group(tgtOp, function (c) {
        var g2 = proj(G_GOAL), cur = proj(attach > 0 && T < S + 0.75 ? tipB : GP), reached = rp(T, M + 5.9, M + 6.3);
        var R = 30 + 10 * (1 - reached);
        c.strokeStyle = YEL;
        c.beginPath(); c.arc(g2[0], g2[1], R, 0, Math.PI * 2);
        c.lineWidth = 2 + reached; c.setLineDash(reached > 0.5 ? [] : [7, 7]); c.stroke();
        c.setLineDash([]);
        c.beginPath();
        c.moveTo(g2[0] - R - 16, g2[1]); c.lineTo(g2[0] - R - 4, g2[1]);
        c.moveTo(g2[0] + R + 4, g2[1]); c.lineTo(g2[0] + R + 16, g2[1]);
        c.moveTo(g2[0], g2[1] - R - 16); c.lineTo(g2[0], g2[1] - R - 4);
        c.moveTo(g2[0], g2[1] + R + 4); c.lineTo(g2[0], g2[1] + R + 16);
        c.lineWidth = 2; c.stroke();
        if (reached < 1) {
          c.beginPath(); c.moveTo(cur[0], cur[1]); c.lineTo(g2[0], g2[1]);
          c.lineWidth = 1.5; c.setLineDash([4, 8]); c.globalAlpha = 1 - reached; c.stroke();
          c.setLineDash([]); c.globalAlpha = 1;
        }
        label(c, 'TARGET', g2[0] + R + 26, g2[1] + R + 30, YEL);
      });
    }

    // ── Instruments + pose overlays (far one first)
    var toolOp = rp(T, P + 3.0, P + 4.2) * (1 - rp(T, S + 2.6, S + 3.6));
    var poseOp = rp(T, P + 5.0, P + 5.8) * (1 - 0.55 * rp(T, E - 0.4, E + 0.6)) * (1 - rp(T, S + 2.2, S + 3.0));
    var tools = [
      { tip: tipA, dir: DIR_A, jaw: jawA, label: 'INSTRUMENT 1' },
      { tip: tipB, dir: DIR_B, jaw: jawB, label: 'INSTRUMENT 2' }
    ].sort(function (a, b) { return proj(b.tip)[2] - proj(a.tip)[2]; });
    tools.forEach(function (t) {
      group(toolOp, function (c) { drawTool(c, t.tip, t.dir, t.jaw, cam, proj); });
    });
    tools.forEach(function (t) {
      group(poseOp, function (c) { drawPose(c, t.tip, t.dir, t.jaw, proj, t.label); });
    });
  }

  function draw(T) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stageTransform(ctx);
    renderScene(T);
  }

  // ── Sizing: fit the 1920×1080 stage into the box (contain) ──────────────────
  var time = reduce ? STILL_T : 0;
  function resize() {
    var cw = stage.clientWidth, ch = stage.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = layer.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = layer.height = Math.max(1, Math.round(ch * dpr));
    var s = Math.min(cw / W, ch / H);
    scale = s * dpr;
    offX = ((cw - W * s) / 2) * dpr;
    offY = ((ch - H * s) / 2) * dpr;
    if (dither) {
      // Stage-space dither (7px grid in 1920 units), scaled with the stage.
      dither.style.backgroundImage = 'radial-gradient(rgba(255,255,255,0.09) ' + (1.1 * s).toFixed(2) + 'px, transparent ' + (1.6 * s).toFixed(2) + 'px)';
      dither.style.backgroundSize = (7 * s).toFixed(2) + 'px ' + (7 * s).toFixed(2) + 'px';
    }
    draw(time);
  }

  // ── Playback: loop, pause when off-screen or hidden ─────────────────────────
  var raf = 0, last = null, inView = true;
  function tick(ts) {
    if (last == null) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    time = (time + dt) % END;
    draw(time);
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (reduce || raf || !inView || document.hidden) return;
    last = null;
    raf = requestAnimationFrame(tick);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(time); });
  if (reduce) return;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) start(); else stop();
    }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  start();
})();
