/* Magnetic Vine Robots — research hero animation.
   Canvas port of the Claude Design "MagneticVine" scene (captions + HUD off,
   as used in the hero): a halftone lumen with a decoy branch, a vine robot
   that grows from its tip, a cutaway of the everting tip, an external magnet
   that steers it, and sampling at a target — Grow → Evert → Steer → Navigate
   → Sample on a 38.5 s loop. Authored on a 1920×1080 stage scaled to fit its
   box. Pauses off-screen / in background tabs; still frame under
   prefers-reduced-motion. */
(function () {
  'use strict';
  var canvas = document.getElementById('vine-hero');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentNode;
  var dither = stage.querySelector('.ah-stage__dither');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Stage + palette ─────────────────────────────────────────────────────────
  var VW = 1920, VH = 1080, VFOC = 1250, VCX = VW * 0.57, VCY = VH * 0.5;
  var YEL = '#F8CD04', INK = '#0A0A0A', G3 = '#C2C2C2', G4 = '#9A9A9A', G5 = '#757575';
  var LABEL_FONT = '600 20px Raleway, sans-serif';

  // Scene cues (running sum of the authored scene durations).
  var G = 0, E = 6, S = 15, N = 23.5, SM = 31.5, END = 38.5;
  var STILL_T = N + 3;  // representative frame for reduced motion
  var START_T = 2.5;    // first play begins mid-scan so the hero isn't empty on load

  // ── Maths ──────────────────────────────────────────────────────────────────
  var MOVE = function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; };
  var ENTER = function (t) { return (--t) * t * t + 1; };
  var FADE = function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; };
  function cl(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return v < a ? a : v > b ? b : v; }
  function rp(T, a, b, e) { return (e || FADE)(cl((T - a) / (b - a))); }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
  function nrm(a) { var l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
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

  // ── Centreline tubes (Catmull-Rom + parallel-transport frames) ──────────────
  function buildTube(ctrl, per) {
    var P = [ctrl[0]].concat(ctrl, [ctrl[ctrl.length - 1]]), pts = [], i, k;
    for (i = 1; i < P.length - 2; i++) for (k = 0; k < per; k++) {
      var t = k / per, t2 = t * t, t3 = t2 * t, p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      pts.push([0, 1, 2].map(function (d) {
        return 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
      }));
    }
    pts.push(ctrl[ctrl.length - 1]);
    var n = pts.length, s = [0], Tn = [], Nn = [], B = [];
    for (i = 1; i < n; i++) s.push(s[i - 1] + len3(sub(pts[i], pts[i - 1])));
    for (i = 0; i < n; i++) Tn.push(nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
    var nn = nrm(cross(Tn[0], [0, 1, 0]));
    for (i = 0; i < n; i++) { nn = nrm(sub(nn, mul(Tn[i], dot(nn, Tn[i])))); Nn.push(nn); B.push(cross(Tn[i], nn)); }
    function at(q) {
      q = cl(q, 0, s[n - 1]);
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var m = (lo + hi) >> 1; if (s[m] <= q) lo = m; else hi = m; }
      var u = (q - s[lo]) / (s[hi] - s[lo] || 1);
      return { p: lerp3(pts[lo], pts[hi], u), t: nrm(lerp3(Tn[lo], Tn[hi], u)) };
    }
    return { pts: pts, s: s, T: Tn, N: Nn, B: B, len: s[n - 1], at: at };
  }
  var MAIN = buildTube([[-1.9, 0.0, 0.3], [-1.3, 0.01, 0.26], [-0.7, 0.04, 0.12], [-0.15, 0.08, 0.0], [0.15, 0.38, -0.12],
    [0.5, 0.6, -0.05], [0.95, 0.6, 0.25], [1.25, 0.38, 0.45], [1.42, 0.08, 0.35]], 14);
  var SJ = MAIN.s[3 * 14], SK = MAIN.s[6 * 14];
  var DECOY1 = buildTube([[-0.15, 0.08, 0.0], [0.2, -0.22, 0.22], [0.6, -0.38, 0.35], [1.0, -0.4, 0.25]], 12);
  var DECOY2 = buildTube([[0.95, 0.6, 0.25], [1.25, 0.8, 0.12], [1.45, 0.86, 0.02]], 12);
  function LR(u) { return 0.155 - 0.035 * u; }
  var VR = 0.09;
  var LESION = (function () { var i = MAIN.pts.length - 6; return add(MAIN.pts[i], mul(MAIN.B[i], LR(1) * 0.9)); })();
  var VLIGHT = nrm([-0.5, 0.9, 0.6]);
  // Vine rests on the lower wall of the lumen (contact line)
  function vineAt(q) {
    var f = MAIN.at(q), d = nrm(add([0, -1, 0], mul(f.t, f.t[1])));
    return { p: add(f.p, mul(d, LR(cl(q / MAIN.len)) * 0.97 - VR - 0.004)), t: f.t };
  }

  // Static wall dots: position, outward normal, reveal parameter, lesion weight
  var WPX = [], WPY = [], WPZ = [], WNX = [], WNY = [], WNZ = [], WRV = [], WLW = [];
  (function () {
    function nearMain(p) { var m = 9; for (var i = 0; i < MAIN.pts.length; i++) { var d = len3(sub(p, MAIN.pts[i])); if (d < m) m = d; } return m; }
    function ring(tube, rFn, sOff, RN, step, clipMain) {
      for (var q = 0; q <= tube.len; q += step) {
        var p = tube.at(q).p, i = 0;
        while (i < tube.s.length - 1 && tube.s[i + 1] < q) i++;
        var u = q / tube.len;
        for (var k = 0; k < RN; k++) {
          var a = (k / RN) * Math.PI * 2 + (Math.round(q / step) % 2) * (Math.PI / RN);
          var o = add(mul(tube.N[i], Math.cos(a)), mul(tube.B[i], Math.sin(a)));
          var r = rFn(u) * (1 + 0.03 * Math.sin(9 * q + 3 * a));
          var pos = add(p, mul(o, r));
          if (clipMain && nearMain(pos) < LR(0.5) * 0.95) continue;
          var dl = len3(sub(pos, LESION));
          WPX.push(pos[0]); WPY.push(pos[1]); WPZ.push(pos[2]);
          WNX.push(o[0]); WNY.push(o[1]); WNZ.push(o[2]);
          WRV.push(sOff + q); WLW.push(Math.exp(-(dl * dl) / 0.012));
        }
      }
    }
    ring(MAIN, LR, 0, 30, 0.03, false);
    ring(DECOY1, function (u) { return LR(0.45) * (1 - 0.35 * u); }, SJ, 16, 0.05, true);
    ring(DECOY2, function (u) { return LR(0.8) * (1 - 0.35 * u); }, SK, 14, 0.05, true);
  })();
  var NW = WPX.length, REV_MAX = Math.max.apply(null, WRV);
  var DOT_X = new Float32Array(NW), DOT_Y = new Float32Array(NW), DOT_KEY = new Uint8Array(NW), DOT_NEAR = new Uint8Array(NW);
  // bucket key = colour index * 32 + level; colours f < n < y, sorted like the original
  var BUCKET_ORDER = (function () {
    var names = [], C = ['f', 'n', 'y'];
    for (var ci = 0; ci < 3; ci++) for (var lv = 1; lv <= 18; lv++) names.push({ name: C[ci] + lv, key: ci * 32 + lv });
    names.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    return names.map(function (x) { return x.key; });
  })();

  // ── Canvas plumbing ────────────────────────────────────────────────────────
  // Group opacity (SVG <g opacity>) is composited through offscreen layers so
  // overlapping shapes fade as one; layers stack for nested groups.
  var layers = [], depth = 0, scale = 1, offX = 0, offY = 0;
  function stageTransform(c) { c.setTransform(scale, 0, 0, scale, offX, offY); }
  function layerAt(i) {
    if (!layers[i]) { var cv = document.createElement('canvas'); layers[i] = { cv: cv, c: cv.getContext('2d') }; }
    var L = layers[i];
    if (L.cv.width !== canvas.width || L.cv.height !== canvas.height) { L.cv.width = canvas.width; L.cv.height = canvas.height; }
    return L;
  }
  function group(parent, op, draw) {
    if (op <= 0.001) return;
    if (op >= 0.999) { draw(parent); return; }
    var L = layerAt(depth++);
    L.c.setTransform(1, 0, 0, 1, 0, 0);
    L.c.clearRect(0, 0, L.cv.width, L.cv.height);
    L.c.globalAlpha = 1;
    stageTransform(L.c);
    draw(L.c);
    depth--;
    parent.save();
    parent.setTransform(1, 0, 0, 1, 0, 0);
    parent.globalAlpha = op;
    parent.drawImage(L.cv, 0, 0);
    parent.restore();
  }
  function text(c, str, x, y, color, align, font, spacing) {
    c.font = font || LABEL_FONT;
    if ('letterSpacing' in c) c.letterSpacing = spacing == null ? '3.2px' : spacing;
    c.fillStyle = color;
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillText(str, x, y);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.textAlign = 'left';
  }
  function poly(c, pts, close) {
    for (var i = 0; i < pts.length; i++) { if (i) c.lineTo(pts[i][0], pts[i][1]); else c.moveTo(pts[i][0], pts[i][1]); }
    if (close) c.closePath();
  }
  function line(c, a, b, color, w, alpha, cap) {
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
    c.strokeStyle = color; c.lineWidth = w; c.globalAlpha = alpha == null ? 1 : alpha; c.lineCap = cap || 'butt';
    c.stroke(); c.globalAlpha = 1; c.lineCap = 'butt';
  }
  function arrow(c, A, B, color, w, op) {
    var dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, hs = 5 + w * 2;
    c.globalAlpha = op;
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0] - ux * hs * 0.6, B[1] - uy * hs * 0.6);
    c.strokeStyle = color; c.lineWidth = w; c.stroke();
    c.beginPath(); c.moveTo(B[0], B[1]);
    c.lineTo(B[0] - ux * hs * 1.5 - uy * hs * 0.8, B[1] - uy * hs * 1.5 + ux * hs * 0.8);
    c.lineTo(B[0] - ux * hs * 1.5 + uy * hs * 0.8, B[1] - uy * hs * 1.5 - ux * hs * 0.8);
    c.closePath(); c.fillStyle = color; c.fill();
    c.globalAlpha = 1;
  }
  function hull2(pts) {
    var p = pts.sort(function (u, v) { return u[0] - v[0] || u[1] - v[1]; });
    function cr(o, u, v) { return (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]); }
    var lo = [], up = [], i, q;
    for (i = 0; i < p.length; i++) { q = p[i]; while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (i = p.length - 1; i >= 0; i--) { q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  function basis(d) { var a = nrm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])); return [a, cross(d, a)]; }
  function cylHull(c0, c1, r, proj) {
    var d = nrm(sub(c1, c0)), ab = basis(d), pts = [];
    [c0, c1].forEach(function (cc) {
      for (var k = 0; k < 18; k++) { var t = (k / 18) * Math.PI * 2; pts.push(proj(add(cc, add(mul(ab[0], r * Math.cos(t)), mul(ab[1], r * Math.sin(t)))))); }
    });
    return hull2(pts);
  }
  function ellipsePts(cen, d, r, proj) {
    var ab = basis(d), out = [];
    for (var k = 0; k < 24; k++) { var t = (k / 24) * Math.PI * 2; out.push(proj(add(cen, add(mul(ab[0], r * Math.cos(t)), mul(ab[1], r * Math.sin(t)))))); }
    return out;
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  function Lf(t) {
    var v0 = 0.075;
    if (t < G + 0.8) return 0.02;
    if (t < S) return 0.02 + (t - G - 0.8) * v0;
    if (t < S + 2.6) {
      var L0 = 0.02 + (S - G - 0.8) * v0, u = (t - S) / 2.6;
      return (2 * u * u * u - 3 * u * u + 1) * L0 + (u * u * u - 2 * u * u + u) * 2.6 * v0 + (-2 * u * u * u + 3 * u * u) * (SJ - 0.2);
    }
    return keys([[S + 4.6, SJ - 0.2], [S + 8.2, SJ + 0.72], [N + 0.2, SJ + 0.72], [N + 7.2, MAIN.len - 0.1]], t);
  }

  function renderScene(T) {
    // Growth + field
    var L = Lf(T);
    var tipI = vineAt(L), tip = tipI.p;
    var look = keys([[G, 0.12], [S + 2.4, 0.04], [S + 4.4, 0.62], [S + 8, 0.3], [N + 7, 0.3]], T);
    var Bd = sub(vineAt(Math.min(L + look, MAIN.len)).p, tip);
    Bd = len3(Bd) < 0.05 ? tipI.t : nrm(Bd);

    // Camera
    var C0 = [-0.15, 0.25, 0.15];
    var follow = keys([[0, 0], [G + 3, 0], [S + 1, 0.3], [N, 0.3], [N + 7, 0.12], [SM + 1.5, 0.12], [SM + 5.5, 0]], T);
    var c = rp(T, E - 0.4, E + 1.8, MOVE) * (1 - rp(T, S - 1.8, S + 0.3, MOVE));
    var target = lerp3(lerp3(C0, tip, follow), add(tip, mul(tipI.t, -0.14)), c);
    var dist = lerp(keys([[0, 4.5], [S, 4.0], [N + 4, 3.95], [SM + 1.5, 3.8], [SM + 6, 4.6]], T), 1.05, c);
    var sw = Math.sin((2 * Math.PI * T) / END);
    var az = lerp(-0.22 + 0.3 * sw, 0.2 + 0.05 * sw, c);
    var el = lerp(0.42 + 0.06 * Math.sin((4 * Math.PI * T) / END), 0.16, c);
    var cam = add(target, mul([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], dist));
    var fw = nrm(sub(target, cam)), rt = nrm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
    var OX = keys([[S, 0], [N + 2.5, 150], [SM + 4, 150], [SM + 6.5, 0]], T), OY = keys([[S, 0], [N + 2.5, -150], [SM + 4, -150], [SM + 6.5, 0]], T);
    function proj(p) {
      var vx = p[0] - cam[0], vy = p[1] - cam[1], vz = p[2] - cam[2];
      var z = Math.max(0.05, vx * fw[0] + vy * fw[1] + vz * fw[2]);
      return [VCX + OX + (VFOC * (vx * rt[0] + vy * rt[1] + vz * rt[2])) / z, VCY + OY - (VFOC * (vx * up[0] + vy * up[1] + vz * up[2])) / z, z];
    }

    // Anatomy: halftone wall, split into far / near wall around the robot
    var sceneOp = 1 - rp(T, END - 2.4, END - 0.5);
    var revP = rp(T, G + 0.1, G + 4.4, FADE), rev = lerp(-0.2, REV_MAX + 0.2, revP);
    var lesionOp = rp(T, N + 0.5, N + 2.0);
    var nd = 0;
    for (var k = 0; k < NW; k++) {
      if (WRV[k] > rev) continue;
      var vx = WPX[k] - cam[0], vy = WPY[k] - cam[1], vz = WPZ[k] - cam[2];
      var dz = Math.max(0.05, vx * fw[0] + vy * fw[1] + vz * fw[2]);
      var front = -(WNX[k] * vx + WNY[k] * vy + WNZ[k] * vz) > 0; // dot(n, cam - pos)
      var sg = front ? 1 : -1;
      var sh = cl((WNX[k] * VLIGHT[0] + WNY[k] * VLIGHT[1] + WNZ[k] * VLIGHT[2]) * sg * 1.1 + (front ? -0.05 : 0.15));
      var base = front ? 0.7 + 3.4 * Math.pow(sh, 1.6) : 0.9 + 5.2 * Math.pow(sh, 1.5);
      var lvl = Math.max(1, Math.min(18, Math.round(base * (3.4 / dz) * 2)));
      var col = front ? 1 : 0; // n : f
      if (rev - WRV[k] < 0.16 && revP < 1) col = 2;
      else if (WLW[k] * lesionOp > 0.35) col = 2;
      DOT_X[nd] = VCX + OX + (VFOC * (vx * rt[0] + vy * rt[1] + vz * rt[2])) / dz;
      DOT_Y[nd] = VCY + OY - (VFOC * (vx * up[0] + vy * up[1] + vz * up[2])) / dz;
      DOT_KEY[nd] = col * 32 + lvl; DOT_NEAR[nd] = front ? 1 : 0; nd++;
    }
    function dotLayer(cx, wantNear) {
      cx.lineCap = 'round';
      for (var b = 0; b < BUCKET_ORDER.length; b++) {
        var key = BUCKET_ORDER[b], any = false;
        cx.beginPath();
        for (var d = 0; d < nd; d++) if (DOT_KEY[d] === key && DOT_NEAR[d] === wantNear) {
          cx.moveTo(DOT_X[d], DOT_Y[d]); cx.lineTo(DOT_X[d] + 0.01, DOT_Y[d]); any = true;
        }
        if (!any) continue;
        var ci = (key / 32) | 0;
        cx.strokeStyle = ci === 2 ? YEL : '#fff';
        cx.globalAlpha = ci === 2 ? 1 : ci === 0 ? 0.9 : 0.45;
        cx.lineWidth = (key % 32) / 2;
        cx.stroke();
      }
      cx.globalAlpha = 1; cx.lineCap = 'butt';
    }

    // Far wall
    group(ctx, sceneOp, function (cx) { dotLayer(cx, 0); });

    // Vine body (tip-everting: bands stay fixed in the world, new ones appear at the tip)
    var vineOp = rp(T, G + 0.6, G + 1.4);
    var tp = proj(tip), tb = proj(vineAt(Math.max(0, L - 0.1)).p);
    var base0 = vineAt(0).p, baseD = MAIN.T[0];
    if (vineOp > 0) {
      group(ctx, vineOp * sceneOp, function (cx) {
        cx.lineJoin = 'round';
        cx.beginPath(); poly(cx, cylHull(sub(base0, mul(baseD, 0.42)), sub(base0, mul(baseD, 0.02)), 0.16, proj), true);
        cx.fillStyle = INK; cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.stroke();
        cx.lineJoin = 'miter';
        cx.beginPath();
        poly(cx, ellipsePts(sub(base0, mul(baseD, 0.02)), baseD, 0.16, proj), true);
        poly(cx, ellipsePts(sub(base0, mul(baseD, 0.3)), baseD, 0.16, proj), true);
        cx.globalAlpha = 0.55; cx.lineWidth = 1.3; cx.stroke(); cx.globalAlpha = 1;

        var bodyPts = [];
        for (var i = 0; i < MAIN.s.length && MAIN.s[i] < L; i++) bodyPts.push(vineAt(MAIN.s[i]).p);
        bodyPts.push(tip);
        var segs = {}, kk;
        for (i = 0; i < bodyPts.length - 1; i++) {
          var a = proj(bodyPts[i]), b = proj(bodyPts[i + 1]);
          kk = Math.round(Math.max(3, (2 * VFOC * VR) / ((a[2] + b[2]) / 2)));
          (segs[kk] || (segs[kk] = [])).push(a, b);
        }
        var widths = Object.keys(segs).map(Number).sort(function (x, y) { return x - y; });
        cx.lineCap = 'round';
        [['#fff', 4], [INK, 0]].forEach(function (pass) {
          widths.forEach(function (w) {
            var sgs = segs[w];
            cx.beginPath();
            for (var j = 0; j < sgs.length; j += 2) { cx.moveTo(sgs[j][0], sgs[j][1]); cx.lineTo(sgs[j + 1][0], sgs[j + 1][1]); }
            cx.strokeStyle = pass[0]; cx.lineWidth = w + pass[1]; cx.stroke();
          });
        });
        cx.lineCap = 'butt';

        // wall bands (fade out during the close-up)
        var bandOp = 1 - c;
        if (bandOp > 0.001) {
          for (var q = 0.09; q < L - 0.03; q += 0.11) {
            var f = vineAt(q), pa = proj(f.p), pb = proj(add(f.p, mul(f.t, 0.02)));
            var ww = (2 * VFOC * VR) / pa[2], dx = pb[0] - pa[0], dy = pb[1] - pa[1], l = Math.hypot(dx, dy) || 1, px = -dy / l, py = dx / l;
            var fresh = cl(1 - (L - q) / 0.16);
            line(cx, [pa[0] - px * ww * 0.42, pa[1] - py * ww * 0.42], [pa[0] + px * ww * 0.42, pa[1] + py * ww * 0.42],
              fresh > 0 ? YEL : '#fff', 1.4, (0.45 + 0.55 * fresh) * bandOp);
          }
        }
        // yellow magnetic tip
        var tipW = (2 * VFOC * VR) / tp[2];
        group(cx, 1 - cl(c * 1.6), function (c2) {
          line(c2, tb, tp, INK, tipW + 8, 1, 'round');
          line(c2, tb, tp, YEL, tipW + 3, 1, 'round');
        });
      });
    }

    // Near wall (thins out during the close-up)
    group(ctx, sceneOp * (1 - 0.8 * c), function (cx) { dotLayer(cx, 1); });

    // Everting-tip cutaway: tail flows forward, turns inside out at the rim, outer wall stays fixed
    var cutOp = rp(T, E + 0.6, E + 1.6) * (1 - rp(T, S - 1.7, S - 0.7)) * sceneOp;
    if (cutOp > 0.001) {
      group(ctx, cutOp, function (cx) {
        var R = VR, r = VR * 0.4, h = (R - r) / 2, D = 0.6, a0 = L - h, mid = (R + r) / 2;
        function frame(q) { var f = vineAt(q); return { p: f.p, t: f.t, sd: nrm(cross(f.t, sub(cam, f.p))) }; }
        function W(q, rad, sgn) { var f = frame(q); return add(f.p, mul(f.sd, rad * sgn)); }
        var sc = dot(frame(L).sd, [0, -1, 0]) > 0 ? 1 : -1;
        var fr0 = frame(a0);
        function rimPt(ph, sgn) { return add(fr0.p, add(mul(fr0.t, h * Math.cos(ph)), mul(fr0.sd, sgn * (mid + h * Math.sin(ph))))); }
        var qs = Math.max(0.01, L - D), i, sgn;
        // inner tail lines
        cx.beginPath();
        [1, -1].forEach(function (sn) {
          var pts = [];
          for (var j = 0; j < 16; j++) pts.push(proj(W(qs + ((a0 - qs) * j) / 15, r, sn)));
          poly(cx, pts, false);
        });
        cx.strokeStyle = '#fff'; cx.globalAlpha = 0.75; cx.lineWidth = 1.8; cx.stroke(); cx.globalAlpha = 1;
        // everting rim
        cx.beginPath();
        [1, -1].forEach(function (sn) {
          var pts = [];
          for (var j = 0; j < 18; j++) pts.push(proj(rimPt(-Math.PI / 2 + (Math.PI * j) / 17, sn)));
          poly(cx, pts, false);
        });
        cx.strokeStyle = YEL; cx.lineWidth = 3; cx.stroke();
        // pressure arrows
        [1, -1].forEach(function (sn) {
          [0.1, 0.24].forEach(function (d) { arrow(cx, proj(W(a0 - d - 0.05, mid, sn)), proj(W(a0 - d + 0.02, mid, sn)), '#fff', 2, 0.55); });
        });
        // material ticks travelling along the tail → rim → outer wall
        var P1 = D - h, P2 = P1 + Math.PI * h, Pt = P2 + D - h, sp = 0.028, nT = Math.ceil(Pt / sp);
        for (sgn = 1; sgn >= -1; sgn -= 2) for (i = 0; i < nT; i++) {
          var u = (((i * sp + L) % Pt) + Pt) % Pt, pos, dir, seg, q, f;
          if (u < P1) { q = L - D + u; if (q < 0.01) continue; f = frame(q); pos = add(f.p, mul(f.sd, r * sgn)); dir = mul(f.sd, sgn); seg = 0; }
          else if (u < P2) { var ph = -Math.PI / 2 + (u - P1) / h; pos = rimPt(ph, sgn); dir = nrm(add(mul(fr0.t, Math.cos(ph)), mul(fr0.sd, sgn * Math.sin(ph)))); seg = 1; }
          else { q = a0 - (u - P2); if (q < 0.01) continue; f = frame(q); pos = add(f.p, mul(f.sd, R * sgn)); dir = mul(f.sd, sgn); seg = 2; }
          var fe = cl(Math.min(u, Pt - u) / 0.1);
          line(cx, proj(sub(pos, mul(dir, 0.012))), proj(add(pos, mul(dir, 0.012))), seg === 2 ? G3 : YEL, 2.6, fe);
        }
        // normal-force arrows
        var nfOp = rp(T, E + 4.4, E + 5.2);
        if (nfOp > 0) for (i = 0; i < 5; i++) {
          var qn = L - 0.08 - i * 0.09;
          if (qn > 0.02) arrow(cx, proj(W(qn, R + 0.006, sc)), proj(W(qn, R + 0.052, sc)), YEL, 3, nfOp);
        }
        // callouts
        var b1 = rp(T, E + 1.6, E + 2.4) * (1 - rp(T, E + 4.3, E + 4.9)), b2 = rp(T, E + 4.9, E + 5.7) * (1 - rp(T, S - 2.2, S - 1.6));
        function lbl(anc, at, txt, op, colr) {
          if (op <= 0.001) return;
          var a = proj(anc), b = proj(at);
          cx.globalAlpha = op;
          cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1] + (b[1] < a[1] ? 10 : -26));
          cx.strokeStyle = G4; cx.lineWidth = 1.2; cx.stroke();
          cx.beginPath(); cx.arc(a[0], a[1], 3.5, 0, Math.PI * 2); cx.fillStyle = colr; cx.fill();
          text(cx, txt, b[0], b[1], colr, 'center');
          cx.globalAlpha = 1;
        }
        lbl(W(L - 0.32, r, -sc), W(L - 0.42, R + 0.13, -sc), 'TAIL FLOWS FORWARD', b1, YEL);
        lbl(rimPt(0, -sc), W(L + 0.1, R + 0.13, -sc), 'TURNS INSIDE OUT AT THE TIP', b1, YEL);
        lbl(W(L - 0.46, R, -sc), W(L - 0.46, R + 0.13, -sc), 'OUTER WALL STAYS STILL', b2, '#fff');
        lbl(W(L - 0.26, R + 0.03, sc), W(L - 0.12, R + 0.16, sc), 'NORMAL FORCE, NO SLIDING', b2, YEL);
      });
    }

    // Target + sampling
    var tgtOp = lesionOp * (1 - rp(T, SM + 4.2, SM + 5.2)) * sceneOp;
    if (tgtOp > 0.001) {
      group(ctx, tgtOp, function (cx) {
        var g = proj(LESION), reached = rp(T, N + 6.8, N + 7.3), R = 44 + 12 * (1 - reached);
        cx.strokeStyle = YEL;
        cx.beginPath(); cx.arc(g[0], g[1], R, 0, Math.PI * 2);
        cx.lineWidth = 2 + reached; cx.setLineDash(reached > 0.5 ? [] : [7, 7]); cx.stroke(); cx.setLineDash([]);
        cx.beginPath();
        cx.moveTo(g[0] - R - 16, g[1]); cx.lineTo(g[0] - R - 4, g[1]);
        cx.moveTo(g[0] + R + 4, g[1]); cx.lineTo(g[0] + R + 16, g[1]);
        cx.moveTo(g[0], g[1] - R - 16); cx.lineTo(g[0], g[1] - R - 4);
        cx.moveTo(g[0], g[1] + R + 4); cx.lineTo(g[0], g[1] + R + 16);
        cx.lineWidth = 2; cx.stroke();
        if (T > SM) for (var k2 = 0; k2 < 3; k2++) {
          var ph = ((T - SM) * 0.6 + k2 / 3) % 1;
          cx.beginPath(); cx.arc(g[0], g[1], R + ph * 70, 0, Math.PI * 2);
          cx.globalAlpha = (1 - ph) * 0.6; cx.lineWidth = 1.5; cx.stroke(); cx.globalAlpha = 1;
        }
        if (T > SM + 0.4 && T < SM + 4.4) for (var k3 = 0; k3 < 9; k3++) {
          var ph2 = ((T - SM) * 0.9 + k3 / 9) % 1, qp = proj(lerp3(LESION, tip, MOVE(ph2)));
          cx.globalAlpha = Math.sin(Math.PI * ph2) * rp(T, SM + 0.4, SM + 1) * (1 - rp(T, SM + 3.8, SM + 4.4));
          cx.beginPath(); cx.arc(qp[0], qp[1], 4.5, 0, Math.PI * 2); cx.fillStyle = YEL; cx.fill();
          cx.globalAlpha = 1;
        }
        text(cx, 'TARGET', g[0] + R + 26, g[1] + R + 26, YEL);
      });
    }

    // External magnet + field lines
    var magIn = rp(T, S + 0.2, S + 1.8, ENTER), magOut = rp(T, N + 5.2, N + 6.8);
    var magOp = magIn * (1 - magOut) * sceneOp;
    if (magOp > 0.001) {
      var Mc = add(add(add(tip, keys([[S + 5, [-0.15, 0.62, 0.55]], [N + 1.5, [0.05, 0.45, 0.75]]], T)), [0, 1.2 * (1 - magIn) + 1.2 * magOut, 0]), mul(Bd, 0.15));
      var Mn = add(Mc, mul(Bd, 0.24)), Ms = sub(Mc, mul(Bd, 0.24));
      var side = nrm(cross(sub(tip, Mc), fw));
      group(ctx, magOp, function (cx) {
        cx.setLineDash([3, 10]); cx.lineDashOffset = -T * 42;
        for (var kk = -2; kk <= 2; kk++) {
          var ctrl = add(lerp3(Mc, tip, 0.5), add(mul(side, kk * 0.22), [0, 0.1, 0])), pts = [];
          for (var j = 0; j < 22; j++) {
            var t = j / 21;
            pts.push(proj(add(add(mul(Mc, (1 - t) * (1 - t)), mul(ctrl, 2 * t * (1 - t))), mul(tip, t * t))));
          }
          cx.beginPath(); poly(cx, pts, false);
          cx.strokeStyle = YEL; cx.globalAlpha = kk === 0 ? 0.7 : 0.4; cx.lineWidth = 1.6; cx.stroke();
        }
        cx.globalAlpha = 1; cx.setLineDash([]); cx.lineDashOffset = 0;
        cx.lineJoin = 'round'; cx.lineWidth = 2;
        cx.beginPath(); poly(cx, cylHull(Ms, Mc, 0.17, proj), true); cx.fillStyle = INK; cx.fill(); cx.strokeStyle = '#fff'; cx.stroke();
        cx.beginPath(); poly(cx, cylHull(Mc, Mn, 0.17, proj), true); cx.fillStyle = YEL; cx.fill(); cx.strokeStyle = INK; cx.stroke();
        cx.lineJoin = 'miter';
        cx.beginPath(); poly(cx, ellipsePts(Mc, Bd, 0.17, proj), true); cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.stroke();
        var mp = proj(Mc), lo = 1 - rp(T, N + 0.3, N + 1.2);
        if (lo > 0) { cx.globalAlpha = lo; text(cx, 'EXTERNAL MAGNET', mp[0] - 110, mp[1] - 10, G3, 'right'); cx.globalAlpha = 1; }
      });
      group(ctx, magOp, function (cx) {
        var a0 = proj(add(tip, mul(Bd, 0.05))), a1 = proj(add(tip, mul(Bd, 0.38)));
        var dx = a1[0] - a0[0], dy = a1[1] - a0[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        line(cx, a0, a1, YEL, 3);
        cx.beginPath(); cx.moveTo(a1[0] + ux * 14, a1[1] + uy * 14);
        cx.lineTo(a1[0] - uy * 8, a1[1] + ux * 8); cx.lineTo(a1[0] + uy * 8, a1[1] - ux * 8); cx.closePath();
        cx.fillStyle = YEL; cx.fill();
        text(cx, 'B', a1[0] + ux * 22 + 6, a1[1] + uy * 22 + 6, YEL, 'left', "700 26px 'Space Grotesk', sans-serif", '0px');
      });
    }

    // In-scene labels
    var baseLbl = rp(T, G + 1.2, G + 2.0) * (1 - rp(T, S - 0.6, S)) * sceneOp;
    if (baseLbl > 0.001) {
      var bp = proj(sub(base0, mul(baseD, 0.22)));
      ctx.globalAlpha = baseLbl; text(ctx, 'BASE', bp[0] - 40, bp[1] + 70, G3); ctx.globalAlpha = 1;
    }
    var tipLbl = rp(T, S + 1.6, S + 2.4) * (1 - rp(T, N + 0.2, N + 1.0)) * sceneOp;
    if (tipLbl > 0.001) {
      line(ctx, [tp[0], tp[1] + 10], [tp[0] - 30, tp[1] + 70], G4, 1.2, tipLbl);
      ctx.globalAlpha = tipLbl; text(ctx, 'MAGNETIC TIP', tp[0] - 200, tp[1] + 96, G3); ctx.globalAlpha = 1;
    }
    var decoyLbl = rp(T, S + 2.6, S + 3.4) * (1 - rp(T, S + 6.6, S + 7.4)) * sceneOp;
    if (decoyLbl > 0.001) {
      var dp = proj(DECOY1.at(0.55).p);
      ctx.globalAlpha = decoyLbl; text(ctx, 'ALTERNATIVE BRANCH', dp[0] + 30, dp[1] + 60, G5); ctx.globalAlpha = 1;
    }
  }

  function draw(T) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stageTransform(ctx);
    renderScene(T);
  }

  // ── Sizing: fit the 1920×1080 stage into the box (contain) ──────────────────
  var time = reduce ? STILL_T : START_T;
  function resize() {
    var cw = stage.clientWidth, ch = stage.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    var s = Math.min(cw / VW, ch / VH);
    scale = s * dpr;
    offX = ((cw - VW * s) / 2) * dpr;
    offY = ((ch - VH * s) / 2) * dpr;
    if (dither) {
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
