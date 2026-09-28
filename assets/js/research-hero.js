/* Research landing hero — site integration of the Claude Design "ResearchHero".
   Scene code below is the design's, unchanged, except: no React (the canvas is
   driven directly — see the bottom of this file) and the baked point clouds load
   from /assets/data/. Pauses off-screen / in hidden tabs; still frame under
   prefers-reduced-motion. */
/* Research landing hero — an all-halftone scene. A KUKA LBR iiwa 14 (point cloud
   sampled from the iiwa_stack ROS description meshes, posed by its URDF kinematics
   and a damped-least-squares IK) steers a magnet over anatomy that morphs through
   the six STORM Lab research streams. No line art: everything is dots. */
(function () {
  const DATA = ((document.currentScript && document.currentScript.src) || '/assets/js/').replace(/[^/]*$/, '') + '../data/';
  const YEL = '#F8CD04', FOC = 1250, H = 1080, N = 3000, SCENE = 5, MORPH = 1.25, ASPAN = 5.9, PI = Math.PI;
  const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  const nrm = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const MOVE = (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
  const FADE = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const rp = (T, a, b) => FADE(cl((T - a) / (b - a)));
  const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const basis = (d) => { const a = nrm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])); return [a, cross(d, a)]; };

  // ── KUKA LBR iiwa 14 R820 kinematics (iiwa_description/urdf/iiwa14.xacro) ──
  const S = 2.6;
  const JOINTS = [[[0, 0, 0.1575], [0, 0, 0]], [[0, 0, 0.2025], [PI / 2, 0, PI]], [[0, 0.2045, 0], [PI / 2, 0, PI]], [[0, 0, 0.2155], [PI / 2, 0, 0]], [[0, 0.1845, 0], [-PI / 2, PI, 0]], [[0, 0, 0.2155], [PI / 2, 0, 0]], [[0, 0.081, 0], [-PI / 2, PI, 0]]];
  const LIM = [170, 120, 170, 120, 170, 120, 175].map((d) => (d * PI) / 180);
  const REST = [0, 0.55, 0, -1.35, 0, 0.9, 0];
  const mm = (A, B) => { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return r; };
  const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
  const rpy = (r, p, y) => { const cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(y), sy = Math.sin(y); return [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr, sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr, -sp, cp * sr, cp * cr]; };
  const rz = (q) => { const c = Math.cos(q), s = Math.sin(q); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const JR = JOINTS.map((j) => rpy(...j[1])), JT = JOINTS.map((j) => mul(j[0], S));
  const Z2Y = [1, 0, 0, 0, 0, 1, 0, -1, 0];
  function fk(q, base) {
    let R = Z2Y, t = base; const F = [{ R, t }];
    for (let i = 0; i < 7; i++) { t = add(t, mv(R, JT[i])); R = mm(mm(R, JR[i]), rz(q[i])); F.push({ R, t }); }
    F.push({ R, t: add(t, mv(R, [0, 0, 0.045 * S])) });
    return F;
  }
  function solve6(A, b) {
    const n = 6, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function ik(q, base, target, dir, off, iters = 3) {
    const err = (qq) => { const F = fk(qq, base), E = F[8], z = [E.R[2], E.R[5], E.R[8]], p = add(E.t, mul(z, off)), o = mul(sub(dir, z), 0.8); const d = sub(target, p); return [d[0], d[1], d[2], o[0], o[1], o[2]]; };
    for (let it = 0; it < iters; it++) {
      const e = err(q), J = [], hh = 1e-3;
      for (let j = 0; j < 7; j++) { const qq = q.slice(); qq[j] += hh; const e2 = err(qq); J.push(e2.map((v, k) => (v - e[k]) / hh)); }
      const A = [], lam = 0.12;
      for (let r = 0; r < 6; r++) { A.push([]); for (let c = 0; c < 6; c++) { let s = 0; for (let j = 0; j < 7; j++) s += J[j][r] * J[j][c]; A[r].push(s + (r === c ? lam * lam : 0)); } }
      const y = solve6(A, e);
      for (let j = 0; j < 7; j++) { let s = 0; for (let r = 0; r < 6; r++) s += J[j][r] * y[r]; q[j] = cl(q[j] + cl(-s + 0.015 * (REST[j] - q[j]), -0.15, 0.15), -LIM[j] * 0.9, LIM[j] * 0.9); }
    }
    return q;
  }
  let ARM = null, PSMD = null;
  const PSM_S = 3.4, PSM_LINKS = [['PSM_base', 'base', 0.9], ['PSM_yaw', 'yaw', 1], ['PSM_pitch_2', 'p2', 1], ['PSM_pitch_3', 'p3', 1], ['PSM_pitch_4', 'p4', 1], ['PSM_pitch_5', 'p5', 1], ['PSM_insertion', 'ins', 1]];
  const TF = (P, xyz, r, q) => ({ R: mm(mm(P.R, rpy(...r)), rz(q || 0)), t: add(P.t, mv(P.R, xyz)) });
  function psmFK(q1, q2, q3) { // dvrk_model/urdf/Classic/PSM_base.urdf.xacro
    const base = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }, H = PI / 2;
    const yaw = TF(base, [0, 0, 0], [0, -H, H], q1), pitch = TF(yaw, [0, 0, 0], [-H, -H, 0], q2);
    const p2 = TF(yaw, [0, 0.0295, 0.5185], [-H, -H, 0], q2), p3 = TF(yaw, [0, 0.0295, 0.4285], [-H, -H, 0], q2);
    const p4 = TF(p2, [0.04178, 0.15007, -0.0137], [0, 0, 0], -q2), p5 = TF(p2, [0.04209, 0.18695, -0.02412], [0, 0, 0], -q2);
    const ins = TF(p4, [-0.52, 0, -0.0155], [0, 0, 0], q2), ad = TF(pitch, [0, 0.4318, 0], [H, 0, 0], 0);
    ad.t = add(ad.t, mv(ad.R, [0, 0, q3]));
    return { base, yaw, p2, p3, p4, p5, ins, ad };
  }
  fetch(DATA + 'dvrk-psm-v2.json').then((r) => r.json()).then((d) => { PSMD = {}; Object.keys(d.links).forEach((k) => { const f = d.links[k], n = f.length / 6, P = new Float32Array(n * 3), Nn = new Float32Array(n * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { P[i * 3 + c] = f[i * 6 + c]; Nn[i * 3 + c] = f[i * 6 + 3 + c]; } PSMD[k] = { P, Nn, n }; }); }).catch(() => {});
  fetch(DATA + 'iiwa14-points.json').then((r) => r.json()).then((d) => {
    ARM = d.links.map((f) => { const n = f.length / 6, P = new Float32Array(n * 3), Nn = new Float32Array(n * 3); for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { P[i * 3 + k] = f[i * 6 + k] * S; Nn[i * 3 + k] = f[i * 6 + 3 + k]; } } return { P, Nn, n }; });
  }).catch(() => {});

  // ── Local dot kits (end-effector magnet, tool, capsule) ─────────────────────
  function shell(R, z0, z1, sp, caps) {
    const o = [];
    for (let z = z0, j = 0; z <= z1 + 1e-6; z += sp, j++) { const m = Math.round((2 * PI * R) / sp); for (let k = 0; k < m; k++) { const a = ((k + (j % 2) * 0.5) / m) * 2 * PI; o.push([R * Math.cos(a), R * Math.sin(a), z, Math.cos(a), Math.sin(a), 0]); } }
    if (caps) [[z0, -1], [z1, 1]].forEach(([z, s]) => { for (let r = sp * 0.8; r < R; r += sp) { const m = Math.round((2 * PI * r) / sp); for (let k = 0; k < m; k++) { const a = (k / m) * 2 * PI; o.push([r * Math.cos(a), r * Math.sin(a), z, 0, 0, s]); } } o.push([0, 0, z, 0, 0, s]); });
    return o;
  }
  const MAG = (() => { const o = []; shell(0.15, -0.15, 0.15, 0.034, true).forEach((m) => o.push([m[2], m[1], m[0] + 0.19, m[5], m[4], m[3], 0])); shell(0.06, 0, 0.05, 0.03, false).forEach((m) => o.push(m.concat([1]))); return o; })(), MAG_L = 0.34;
  const CAP = (() => { const o = shell(0.13, -0.2, 0.2, 0.034, false); [[0.2, 1], [-0.2, -1]].forEach(([z0, s]) => { for (let el = 0.3; el < PI / 2; el += 0.3) { const r = 0.13 * Math.cos(el), m = Math.max(4, Math.round((2 * PI * r) / 0.034)); for (let k = 0; k < m; k++) { const a = (k / m) * 2 * PI, n = [Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el), s * Math.sin(el)]; o.push([r * Math.cos(a), r * Math.sin(a), z0 + s * 0.13 * Math.sin(el), ...n]); } } }); return o; })();
  const TOOL_L = 0.42;
  const OLO = (() => { const o = [], r = 0.27, C = [r / 2, 0, 0]; for (let ti = 0; ti <= 30; ti++) { const t = -(2 * PI) / 3 + ((4 * PI) / 3) * (ti / 30), c = Math.cos(t), P1 = [r * c, r * Math.sin(t), 0], z2 = (r * Math.sqrt(Math.max(0, 1 + 2 * c))) / (1 + c), x2 = r * (1 - c / (1 + c)); for (const sg of [-1, 1]) for (let u = 0; u <= 1.0001; u += 0.1) { const p = sub(lerp3(P1, [x2, 0, sg * z2], u), C), n = nrm(p); o.push([p[0], p[1], p[2], n[0], n[1], n[2]]); } } return o; })();
  const EXTM = shell(0.3, -0.09, 0.09, 0.045, true).map((m) => [m[0], m[2], m[1], m[3], m[5], m[4]]);

  function buildTube(ctrl, per) {
    const P = [ctrl[0]].concat(ctrl, [ctrl[ctrl.length - 1]]), pts = [];
    for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t, p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      pts.push([0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
    pts.push(ctrl[ctrl.length - 1]);
    const n = pts.length, s = [0], Tn = [], Nn = [], B = [];
    for (let i = 1; i < n; i++) s.push(s[i - 1] + len3(sub(pts[i], pts[i - 1])));
    for (let i = 0; i < n; i++) Tn.push(nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
    let nn = nrm(cross(Tn[0], Math.abs(Tn[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    for (let i = 0; i < n; i++) { nn = nrm(sub(nn, mul(Tn[i], dot(nn, Tn[i])))); Nn.push(nn); B.push(cross(Tn[i], nn)); }
    const at = (q) => {
      q = cl(q, 0, s[n - 1]); let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= q) lo = m; else hi = m; }
      const u = (q - s[lo]) / (s[hi] - s[lo] || 1);
      return { p: lerp3(pts[lo], pts[hi], u), t: nrm(lerp3(Tn[lo], Tn[hi], u)), i: lo };
    };
    return { pts, s, T: Tn, N: Nn, B, len: s[n - 1], at };
  }
  const tubeP = (tube, rFn, o = {}) => ({
    ...o,
    area() { let a = 0; for (let k = 0; k < 20; k++) a += 2 * PI * rFn((k + 0.5) / 20) * (tube.len / 20); return a; },
    gen(sp, push) {
      let j = 0;
      for (let q = 0; q <= tube.len; q += sp, j++) {
        const f = tube.at(q), r = rFn(q / tube.len), m = Math.max(6, Math.round((2 * PI * r) / sp));
        for (let k = 0; k < m; k++) { const a = ((k + (j % 2) * 0.5) / m) * PI * 2, n = add(mul(tube.N[f.i], Math.cos(a)), mul(tube.B[f.i], Math.sin(a))); push(add(f.p, mul(n, r)), o.sign === -1 ? mul(n, -1) : n); }
      }
    },
  });
  const ellP = (c, rx, ry, rz, o = {}) => ({ ...o, area: () => 4 * PI * ((rx * ry + rx * rz + ry * rz) / 3), gen(sp, push) { const Rm = (rx + ry + rz) / 3; for (let v = sp / Rm / 2; v < PI; v += sp / Rm) { const m = Math.max(4, Math.round((2 * PI * Rm * Math.sin(v)) / sp)); for (let k = 0; k < m; k++) { const uu = (k / m) * 2 * PI + v * 3, n0 = [Math.sin(v) * Math.cos(uu), Math.cos(v), Math.sin(v) * Math.sin(uu)], n = nrm([n0[0] / rx, n0[1] / ry, n0[2] / rz]); push([c[0] + rx * n0[0], c[1] + ry * n0[1], c[2] + rz * n0[2]], o.sign === -1 ? mul(n, -1) : n); } } } });
  const ringYP = (y, r0, r1, o = {}) => ({ ...o, area: () => PI * (r1 * r1 - r0 * r0), gen(sp, push) { let j = 0; for (let r = r0; r <= r1 + 1e-6; r += sp, j++) { const m = Math.max(6, Math.round((2 * PI * r) / sp)); for (let k = 0; k < m; k++) { const an = ((k + (j % 2) * 0.5) / m) * 2 * PI; push([r * Math.cos(an), y, r * Math.sin(an)], [0, 1, 0]); } } } });
  const annP = (z, r0, r1, nz, o = {}) => ({ ...o, area: () => PI * (r1 * r1 - r0 * r0), gen(sp, push) { let j = 0; for (let r = r0; r <= r1; r += sp, j++) { const m = Math.round((2 * PI * r) / sp); for (let k = 0; k < m; k++) { const a = ((k + (j % 2) * 0.5) / m) * PI * 2; push([r * Math.cos(a), r * Math.sin(a), z], [0, 0, nz]); } } } });
  const planeP = (x0, x1, z0, z1, hf, o = {}) => ({
    ...o, area: () => (x1 - x0) * (z1 - z0),
    gen(sp, push) { let j = 0; for (let z = z0; z <= z1; z += sp * 0.866, j++) for (let x = x0 + (j % 2) * sp * 0.5; x <= x1; x += sp) { const e = 0.01; push([x, hf(x, z), z], nrm([-(hf(x + e, z) - hf(x - e, z)) / (2 * e), 1, -(hf(x, z + e) - hf(x, z - e)) / (2 * e)])); } },
  });
  function sample(pieces) {
    let A = 0; pieces.forEach((p) => (A += p.area()));
    const sp = Math.sqrt(A / N), cand = [];
    pieces.forEach((pc, ti) => pc.gen(sp, (p, n) => { if (!pc.skip || !pc.skip(p)) cand.push([p, n, ti]); }));
    const pick = []; for (let i = 0; i < N; i++) pick.push(cand[Math.floor((i * cand.length) / N)]);
    pick.sort((a, b) => a[0][0] - b[0][0]);
    const P = new Float32Array(N * 3), Nn = new Float32Array(N * 3), TG = new Uint8Array(N), BR = new Uint8Array(N);
    pick.forEach((c, i) => { P.set(c[0], i * 3); Nn.set(c[1], i * 3); TG[i] = c[2]; BR[i] = pieces[c[2]].bright ? 1 : 0; });
    return { P, Nn, TG, BR };
  }

  // ── Scenes ──────────────────────────────────────────────────────────────────
  // Each: anatomy pieces, camera, arm base, arm(a) → {p, dir, tool}, dev(a, D) pushes device dots, hl(i,a,p,tg).
  const SC = [];
  { // 01 Magnetic flexible endoscopy
    const colon = buildTube([[-2.7, -0.1, 0.35], [-1.4, 0.12, -0.1], [-0.2, -0.08, 0.15], [1.0, 0.1, -0.12], [2.6, -0.05, 0.25]], 16);
    const st = (a) => colon.at(colon.len * lerp(0.28, 0.72, MOVE(cl(a / 5))));
    SC.push({
      title: 'Magnetic flexible endoscopy', cam: { az: -0.42, el: 0.3, dist: 5.5, tgt: [0.1, 0.5, -0.3] }, base: [-0.3, -1.0, -0.95],
      pieces: [tubeP(colon, (u) => 0.5 * (1 + 0.1 * Math.cos(u * colon.len * 13)))],
      arm(a) { const f = st(a); return { p: add(f.p, [0, 0.85, 0.05]), dir: [0, -1, 0], dev: f.p }; },
      dev(a, D) { const f = st(a); D.body(f.p, f.t); for (let q = 0.1; q < colon.len * lerp(0.28, 0.72, MOVE(cl(a / 5))) - 0.3; q += 0.06) D.dot(colon.at(q).p, 1, 2); },
    });
  }
  // Bronchial tree (trachea with cartilage rings, asymmetric main bronchi, lobar + segmental branches)
  const LS = 0.78;
  const TREE = [
    [[[0, 2.1, 0], [0, 1.4, 0.02], [0, 0.62, 0]], 0.3, 0.28, -1, 1],
    [[[0, 0.62, 0], [-0.3, 0.4, 0.02], [-0.55, 0.12, 0.04]], 0.22, 0.2, 0, 1],
    [[[-0.42, 0.24, 0.03], [-0.85, 0.45, 0.08], [-1.15, 0.8, 0.12]], 0.14, 0.1, 1, 0],
    [[[-0.55, 0.12, 0.04], [-0.65, -0.2, 0.05], [-0.72, -0.5, 0.05]], 0.18, 0.16, 1, 0],
    [[[-0.7, -0.4, 0.05], [-0.95, -0.62, 0.3], [-1.15, -0.78, 0.45]], 0.11, 0.08, 3, 0],
    [[[-0.72, -0.5, 0.05], [-0.82, -1.0, -0.02], [-0.9, -1.55, -0.1]], 0.15, 0.11, 3, 0],
    [[[0, 0.62, 0], [0.4, 0.38, -0.02], [0.85, 0.05, -0.06]], 0.2, 0.18, 0, 1],
    [[[0.85, 0.05, -0.06], [1.2, 0.35, 0], [1.4, 0.75, 0.08]], 0.14, 0.1, 6, 0],
    [[[0.85, 0.05, -0.06], [1.0, -0.6, -0.1], [1.12, -1.45, -0.15]], 0.15, 0.11, 6, 0],
    [[[-1.15, 0.8, 0.12], [-1.3, 1.1, 0.1], [-1.35, 1.35, 0.05]], 0.08, 0.05, 2, 0],
    [[[-1.15, 0.8, 0.12], [-1.45, 0.85, 0.2], [-1.7, 0.8, 0.25]], 0.08, 0.05, 2, 0],
    [[[-0.9, -1.55, -0.1], [-1.15, -1.85, -0.05], [-1.3, -2.1, 0]], 0.08, 0.05, 5, 0],
    [[[-0.9, -1.55, -0.1], [-0.8, -1.95, -0.2], [-0.75, -2.25, -0.25]], 0.08, 0.05, 5, 0],
    [[[1.4, 0.75, 0.08], [1.55, 1.05, 0.05], [1.6, 1.3, 0]], 0.08, 0.05, 7, 0],
    [[[1.4, 0.75, 0.08], [1.75, 0.8, 0.15], [1.95, 0.75, 0.2]], 0.08, 0.05, 7, 0],
    [[[1.12, -1.45, -0.15], [1.4, -1.75, -0.1], [1.55, -2.0, -0.05]], 0.08, 0.05, 8, 0],
    [[[1.12, -1.45, -0.15], [1.0, -1.9, -0.25], [0.95, -2.2, -0.3]], 0.08, 0.05, 8, 0],
  ];
  const LUNG = (() => {
    const segs = TREE.map(([c, r0, r1, par, rg]) => { const cc = c.map((p) => mul(p, LS)); return { c: cc, tb: buildTube(cc, 10), r0: r0 * LS, r1: r1 * LS, par, rg }; });
    const inside = (p, o) => { const P = o.tb.pts; for (let i = 0; i < P.length; i++) { const q = P[i], r = lerp(o.r0, o.r1, o.tb.s[i] / o.tb.len) * 0.97; if ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 < r * r) return true; } return false; };
    const pieces = segs.map((sg, k) => {
      const nb = segs.filter((o, j) => j !== k && (o.par === k || sg.par === j || (o.par === sg.par && sg.par >= 0)));
      return tubeP(sg.tb, (u) => lerp(sg.r0, sg.r1, u) * (sg.rg ? 1 + 0.05 * Math.cos(u * sg.tb.len * 28) : 1), { skip: (p) => nb.some((o) => inside(p, o)) });
    });
    const routeOf = (ids) => { const pts = []; ids.forEach((k, n) => segs[k].c.forEach((p, j) => { if (n > 0 && j === 0) return; pts.push(p); })); return buildTube(pts, 14); };
    return { segs, pieces, routeOf };
  })();
  { // 02 Magnetic tentacles — left lower lobe
    const route = LUNG.routeOf([0, 6, 8, 16]), END = route.at(route.len).p, pr = (a) => MOVE(cl(a / 4.8)), L = (a) => route.len * lerp(0.05, 0.97, pr(a));
    SC.push({
      title: 'Magnetic tentacles', cam: { az: -0.25, el: 0.12, dist: 5.6, tgt: [0.35, -0.25, -0.2] }, base: [1.6, -0.8, -0.6],
      pieces: LUNG.pieces,
      arm(a) { const tip = route.at(L(a)).p, p = lerp3([0.95, 0.75, 0.55], [1.45, -1.05, 0.45], pr(a)); return { p, dir: nrm(sub(tip, p)), dev: tip }; },
      dev(a, D) { const l = L(a); for (let q = 0; q < l; q += 0.035) D.dot(route.at(q).p, l - q < 0.5 ? 5.5 : 4.4, 2); },
      hl(i, a, p) { return a > 4.6 && len3(sub(p, END)) < 0.22; },
    });
  }
  { // 03 Magnetic vine robots — right lower lobe, grows to a peripheral lesion
    const route = LUNG.routeOf([0, 1, 3, 5]), L = (a) => route.len * lerp(0.04, 0.96, MOVE(cl(a / 5.2))), les = add(LUNG.segs[5].c[2], [-0.14, -0.1, 0.08]);
    SC.push({
      title: 'Magnetic vine robots', cam: { az: 0.35, el: 0.12, dist: 4.3, tgt: [-0.5, -0.5, 0] },
      pieces: LUNG.pieces,
      dev(a, D) {
        const l = L(a);
        for (let q = 0, j = 0; q < l; q += 0.06, j++) { const f = route.at(q), b = basis(f.t), tip = l - q < 0.15; for (let k = 0; k < 9; k++) { const an = ((k + (j % 2) * 0.5) / 9) * 2 * PI, n = add(mul(b[0], Math.cos(an)), mul(b[1], Math.sin(an))); D.dot(add(f.p, mul(n, 0.075)), tip ? 3.6 : 2.8, 2, n); } }
        for (let k = 0; k < 48; k++) { const u1 = hash(k, 21) * 2 * PI, v1 = Math.acos(2 * hash(k, 22) - 1), n = [Math.sin(v1) * Math.cos(u1), Math.cos(v1), Math.sin(v1) * Math.sin(u1)]; D.dot(add(les, mul(n, 0.1)), 2.2, 0, n); }
      },
    });
  }
  { // 04 MRI actuated instruments
    const cath = buildTube([[1.8, -0.82, 3.3], [0.9, -0.75, 2.1], [0.3, -0.5, 0.9], [0, -0.25, 0]], 16);
    SC.push({
      title: 'MRI actuated instruments', cam: { az: -0.62, el: 0.2, dist: 6.0, tgt: [0, 0.2, 0] }, base: [-1.3, -1.9, -2.6],
      pieces: [tubeP(buildTube([[0, 0, -1.15], [0, 0, 0], [0, 0, 1.15]], 10), () => 1.3, { sign: -1 }), annP(1.15, 1.32, 2.05, 1), annP(-1.15, 1.32, 2.05, -1)],
            dev(a, D) {
        const L = cath.len * MOVE(cl(a / 2.2)); for (let q = 0; q < L; q += 0.04) D.dot(cath.at(q).p, 1, 0);
        if (a > 2) { const f = cath.at(cath.len), bs = basis(f.t), th = 0.75 * Math.sin((a - 2) * 1.8), ph = 0.5 * Math.sin((a - 2) * 1.1), d = nrm(add(f.t, add(mul(bs[0], Math.sin(th) * 1.4), mul(bs[1], Math.sin(ph))))); for (let k = 1; k <= 9; k++) D.dot(add(f.p, mul(nrm(lerp3(f.t, d, k / 9)), 0.045 * k)), 3, 2); }
      },
      hl(i, a, p, tg) { if (tg !== 0 || a < 0.3) return false; const zp = -1.15 + 2.3 * ((a * 0.42) % 1); return Math.abs(p[2] - zp) < 0.1; },
    });
  }
  { // 05 Magnetically guided ultrasound
    const gut = buildTube([[-2.7, 0.05, 0], [-1.3, -0.06, 0.12], [0, 0, 0], [1.3, 0.06, -0.12], [2.7, -0.05, 0]], 16);
    let CAPP = [0, -0.28, 0];
    const st = (a) => { const f = gut.at(gut.len * (0.5 + 0.06 * Math.sin(a * 0.6))); return { f, c: add(f.p, [0, -0.28, 0]) }; };
    SC.push({
      title: 'Magnetically guided ultrasound', cam: { az: -0.36, el: 0.22, dist: 5.1, tgt: [0, 0.35, -0.3] }, base: [-0.4, -1.05, -1.0],
      pieces: [0.5, 0.72].map((r, k) => tubeP(gut, (u) => r * (1 + 0.03 * Math.sin(u * 40 + k)), { bright: k > 0 })),
      pre(a) { CAPP = st(a).c; },
      arm(a) { const { c } = st(a); return { p: add(c, [0, 1.08, 0.05]), dir: [0, -1, 0], dev: c }; },
      dev(a, D) { const { f, c } = st(a); D.oloid(c, f.t, a * 1.4); },
      hl(i, a, p) { const d = len3(sub(p, CAPP)); for (let k = 0; k < 2; k++) { const R = 0.2 + 1.0 * ((a * 0.55 + k * 0.5) % 1); if (Math.abs(d - R) < 0.065) return true; } return false; },
    });
  }
  { // 06 Autonomy in surgical robotics — two dVRK PSMs (remote centre of motion)
    const hf = (x, z) => -0.35 + 0.14 * Math.sin(1.9 * x) * Math.cos(1.7 * z) + 0.06 * Math.sin(3.1 * x + 1.3 * z);
    const path = buildTube([[-0.25, 0, -0.5], [0.2, 0, -0.3], [0.05, 0, 0.05], [0.5, 0, 0.25], [0.75, 0, -0.05]].map((p) => [p[0], hf(p[0], p[2]) + 0.02, p[2]]), 16);
    path.pts.forEach((p) => (p[1] = hf(p[0], p[2]) + 0.02));
    let PF = null, PD = null;
    const f = (a) => MOVE(cl((a - 0.4) / 4.6));
    SC.push({
      title: 'Autonomy in surgical robotics', cam: { az: -0.5, el: 0.36, dist: 6.6, tgt: [0.05, 0.55, -0.35] }, onTop: true,
      pieces: [planeP(-2.3, 2.3, -1.4, 1.4, hf, { bright: true })],
      prep(P) { PF = new Float32Array(N); PD = new Float32Array(N); for (let i = 0; i < N; i++) { let best = 9, bf = 0; for (let j = 0; j < path.pts.length; j++) { const q = path.pts[j], d = Math.hypot(P[i * 3] - q[0], P[i * 3 + 2] - q[2]); if (d < best) { best = d; bf = path.s[j] / path.len; } } PF[i] = bf; PD[i] = best; } },
      psm: [
        { rcm: [0.25, hf(0.25, -0.1) + 0.62, -0.1], yaw: PI - 0.7, tip: (a) => path.at(path.len * f(a)).p, main: true },
        { rcm: [-0.95, hf(-0.95, 0.1) + 0.62, 0.1], yaw: PI + 0.8, tip: (a) => { const x = -0.6, z = 0.05 + 0.06 * Math.sin(a * 0.8); return [x, hf(x, z) + 0.05 + 0.04 * Math.sin(a * 0.8), z]; } },
      ],
      dev(a, D) { const fa = f(a); for (let q = path.len * fa; q < path.len; q += 0.06) D.dot(path.at(q).p, 1, 1); },
      hl(i, a) { return PD && PD[i] < 0.06 && PF[i] <= f(a); },
    });
  }
  { // Aerosol jet printing — magnetic nanoparticle trace deposited from a focused aerosol beam
    const Y0 = -0.9, rows = [-0.66, -0.22, 0.22, 0.66], ctrl = [];
    rows.forEach((z, k) => { const xs = k % 2 ? [1.15, -1.15] : [-1.15, 1.15]; ctrl.push([xs[0], Y0 + 0.03, z], [xs[1], Y0 + 0.03, z]); });
    const path = buildTube(ctrl, 10), pr = (a) => cl(a / 5.3);
    let PF = null;
    SC.push({
      title: 'Aerosol jet printing', cam: { az: -0.42, el: 0.5, dist: 4.7, tgt: [0, -0.3, 0] },
      pieces: [planeP(-1.6, 1.6, -1.05, 1.05, () => Y0, { bright: true }), tubeP(path, () => 0.05)],
      prep(P) { PF = new Float32Array(N); for (let i = 0; i < N; i++) { if (this.TG[i] !== 1) continue; let best = 9, bf = 0; for (let j = 0; j < path.pts.length; j++) { const q = path.pts[j], d = (P[i * 3] - q[0]) ** 2 + (P[i * 3 + 2] - q[2]) ** 2; if (d < best) { best = d; bf = path.s[j] / path.len; } } PF[i] = bf; } },
      head(a) { return path.at(path.len * pr(a)).p; },
      deform(i, a) {
        if (this.TG[i] !== 1) return null;
        const k = cl(((pr(a) - PF[i]) * path.len) / 0.14);
        if (k >= 1) return null;
        if (k <= 0) return [0, 0, 0, 0, 1, 0, 2];
        const j = i * 3, np = add(this.head(a), [0, 0.16, 0]), m = MOVE(k);
        return [lerp(np[0], this.P[j], m), lerp(np[1], this.P[j + 1], m), lerp(np[2], this.P[j + 2], m), this.Nn[j], this.Nn[j + 1], this.Nn[j + 2], 0];
      },
      hl(i, a, p, tg) { return tg === 1 && (pr(a) - PF[i]) * path.len < 1.4; },
      dev(a, D) {
        const hp = this.head(a), tip = add(hp, [0, 0.16, 0]);
        for (let r = 0; r < 14; r++) { const y = 0.03 * r, rad = 0.04 + (r < 8 ? r * 0.024 : 8 * 0.024), m = Math.max(8, Math.round(rad * 110)); for (let k = 0; k < m; k++) { const an = (k / m) * 2 * PI + r * 0.3, n = [Math.cos(an), 0.3, Math.sin(an)]; D.dot(add(tip, [rad * Math.cos(an), 0.07 * r, rad * Math.sin(an)]), 2.6, 0, n); } }
        if (a < 5.35) for (let k = 0; k < 18; k++) { const t = (a * 2.2 + k / 18) % 1, j1 = hash(k, 31) - 0.5, j2 = hash(k, 32) - 0.5; D.dot(add(lerp3(tip, hp, t), [j1 * 0.04 * (1 - t), 0, j2 * 0.04 * (1 - t)]), 1.8, 2); }
      },
    });
  }
  { // 08 Soft continuum robot — 4 elastomer segments, piecewise-constant curvature
    const Yb = -1.15, NS = 4, Ls = 0.62, Lt = NS * Ls, R0 = 0.24, RB = 0.33;
    const kap = (a, k) => 0.8 * Math.sin(a * 0.9 + k * 1.1) * rp(a, 0, 1.0), phi = (a, k) => k * 1.3 + 0.35 * a;
    const rod = (kx, ky, kz, th) => { const c = Math.cos(th), s1 = Math.sin(th), v = 1 - c; return [c + kx * kx * v, kx * ky * v - kz * s1, kx * kz * v + ky * s1, ky * kx * v + kz * s1, c + ky * ky * v, ky * kz * v - kx * s1, kz * kx * v - ky * s1, kz * ky * v + kx * s1, c + kz * kz * v]; };
    const segT = (K, ph, l) => { const d = [Math.cos(ph), 0, Math.sin(ph)]; if (Math.abs(K) < 1e-4) return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, l, 0] }; const th = K * l; return { R: rod(Math.sin(ph), 0, -Math.cos(ph), th), t: add(mul(d, (1 - Math.cos(th)) / K), [0, Math.sin(th) / K, 0]) }; };
    let cacheA = -1, FR = null;
    const frames = (a) => { if (a === cacheA) return FR; FR = [{ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, Yb, 0] }]; for (let k = 0; k < NS; k++) { const F = FR[k], S1 = segT(kap(a, k), phi(a, k), Ls); FR.push({ R: mm(F.R, S1.R), t: add(F.t, mv(F.R, S1.t)) }); } cacheA = a; return FR; };
    const hel = [], TURNS = 24;
    for (let k = 0; k <= TURNS * 10; k++) { const t = k / (TURNS * 10), an = t * TURNS * 2 * PI; hel.push([0.19 * Math.cos(an), Yb + t * Lt, 0.19 * Math.sin(an)]); }
    const pieces = [tubeP(buildTube(hel, 2), () => 0.022)];
    for (let k = 0; k <= NS * 2; k++) pieces.push(ringYP(Yb + (k * Ls) / 2, k === NS * 2 ? 0.03 : 0.07, 0.3, { bright: true }));
    const TEN0 = pieces.length, TA = [0.3, 0.3 + (2 * PI) / 3, 0.3 + (4 * PI) / 3];
    TA.forEach((an) => pieces.push(tubeP(buildTube([[0.25 * Math.cos(an), Yb, 0.25 * Math.sin(an)], [0.25 * Math.cos(an), Yb + Lt / 2, 0.25 * Math.sin(an)], [0.25 * Math.cos(an), Yb + Lt, 0.25 * Math.sin(an)]], 6), () => 0.014)));
    pieces.push(planeP(-1.1, 1.1, -0.9, 0.9, () => Yb, { bright: true }));
    const PL = pieces.length - 1;
    SC.push({
      title: 'Tendon-driven continuum robots', cam: { az: -0.35, el: 0.22, dist: 5.0, tgt: [0.1, 0.15, 0] },
      pieces,
      deform(i, a) {
        if (this.TG[i] === PL) return null;
        const j = i * 3, P = this.P, Nn = this.Nn, s0 = cl(P[j + 1] - Yb, 0, Lt), k = Math.min(NS - 1, Math.floor(s0 / Ls)), F = frames(a)[k];
        const S1 = segT(kap(a, k), phi(a, k), s0 - k * Ls), Rw = mm(F.R, S1.R), tw = add(F.t, mv(F.R, S1.t));
        const p = add(tw, mv(Rw, [P[j], 0, P[j + 2]])), n = mv(Rw, [Nn[j], Nn[j + 1], Nn[j + 2]]);
        return [p[0], p[1], p[2], n[0], n[1], n[2], 0];
      },
      hl(i, a, p, tg) {
        if (tg < TEN0 || tg === PL) return false;
        const j = i * 3, s0 = cl(this.P[j + 1] - Yb, 0, Lt - 1e-4), k = Math.min(NS - 1, Math.floor(s0 / Ls)), K = kap(a, k), ph = phi(a, k);
        const lx = this.P[j] * Math.cos(ph) + this.P[j + 2] * Math.sin(ph);
        return (K >= 0 ? 1 : -1) * lx > 0.05 && Math.abs(K) > 0.2;
      },
    });
  }
  { // Hexapod (Symétrie-style Stewart platform) — telescoping legs, 6-DOF platform
    const ringY = (y, r0, r1, ny, o = {}) => ({ ...o, area: () => PI * (r1 * r1 - r0 * r0), gen(sp, push) { let j = 0; for (let r = r0; r <= r1; r += sp, j++) { const m = Math.round((2 * PI * r) / sp); for (let k = 0; k < m; k++) { const an = ((k + (j % 2) * 0.5) / m) * 2 * PI; push([r * Math.cos(an), y, r * Math.sin(an)], [0, ny, 0]); } } } });
    const Y0 = -1.1, Y1 = 0.35, C0 = [0, Y1, 0], BA = [], PA = [];
    for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) { const tb = ((k * 120 + sg * 14) * PI) / 180, tp = ((k * 120 + sg * 46) * PI) / 180; BA.push([1.15 * Math.cos(tb), Y0 + 0.06, 1.15 * Math.sin(tb)]); PA.push([0.78 * Math.cos(tp), Y1 - 0.05, 0.78 * Math.sin(tp)]); }
    const pose = (a) => { const r = rp(a, 0, 1.2); return { R: rpy(0.13 * Math.sin(a * 1.1) * r, 0.32 * Math.sin(a * 0.7) * r, 0.13 * Math.sin(a * 1.4 + 1) * r), t: [0.14 * Math.sin(a * 1.3) * r, 0.16 * Math.sin(a * 0.9) * r, 0.12 * Math.cos(a * 1.1) * r - 0.12 * r] }; };
    const legs = (a) => { const P = pose(a); return PA.map((p0, k) => { const p1 = add(add(mv(P.R, sub(p0, C0)), C0), P.t), d = sub(p1, BA[k]), L = len3(d); return { L, d: mul(d, 1 / L), b: basis(mul(d, 1 / L)) }; }); };
    const REST = PA.map((p0, k) => { const d = sub(p0, BA[k]), L = len3(d), dn = mul(d, 1 / L); return { L, d: dn, b: basis(dn) }; });
    let LT = null, cA = -1, cL = null, cP = null;
    const at = (a) => { if (a !== cA) { cA = a; cL = legs(a); cP = pose(a); } return { L: cL, P: cP }; };
    SC.push({
      title: 'Hexapod positioning', cam: { az: -0.45, el: 0.3, dist: 5.2, tgt: [0, -0.3, 0] },
      pieces: [ringY(Y0, 0.95, 1.35, 1, { bright: true }), ringY(Y1, 0.6, 0.96, 1, { bright: true })].concat(PA.map((p0, k) => tubeP(buildTube([BA[k], lerp3(BA[k], p0, 0.5), p0], 6), (u) => (u < 0.52 ? 0.11 : 0.065)))),
      prep() { LT = new Float32Array(N); for (let i = 0; i < N; i++) { const tg = this.TG[i]; if (tg < 2) continue; const R0 = REST[tg - 2]; LT[i] = dot(sub([this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]], BA[tg - 2]), R0.d) / R0.L; } },
      deform(i, a) {
        const tg = this.TG[i]; if (tg === 0) return null;
        const j = i * 3, p = [this.P[j], this.P[j + 1], this.P[j + 2]], n = [this.Nn[j], this.Nn[j + 1], this.Nn[j + 2]], S = at(a);
        if (tg === 1) { const q = add(add(mv(S.P.R, sub(p, C0)), C0), S.P.t), nn = mv(S.P.R, n); return [q[0], q[1], q[2], nn[0], nn[1], nn[2], 0]; }
        const k = tg - 2, R0 = REST[k], L1 = S.L[k], t = LT[i], s0 = t * R0.L, rad = sub(p, add(BA[k], mul(R0.d, s0)));
        const c0 = dot(rad, R0.b[0]), c1 = dot(rad, R0.b[1]), along = t < 0.52 ? s0 : L1.L - (R0.L - s0);
        const q = add(add(BA[k], mul(L1.d, along)), add(mul(L1.b[0], c0), mul(L1.b[1], c1)));
        const nn = add(add(mul(L1.d, dot(n, R0.d)), mul(L1.b[0], dot(n, R0.b[0]))), mul(L1.b[1], dot(n, R0.b[1])));
        return [q[0], q[1], q[2], nn[0], nn[1], nn[2], 0];
      },
      hl(i, a, p, tg) { if (tg < 2) return false; const t = LT[i]; if (t < 0.5 || t > 0.66) return false; const k = tg - 2; return legs(a + 0.06)[k].L > at(a).L[k].L + 0.001; },
    });
  }
  { // Collaborative magnetic manipulation — two robot-held magnets shape one soft catheter
    const B0 = [0, 0.95, 0.05];
    const shape = (a) => { const s1 = Math.sin(a * 0.85), c1 = Math.cos(a * 0.6); return { mid: [0.42 * s1, 0.15, 0.12 * c1], tip: [-0.48 * s1, -0.55 + 0.08 * Math.cos(a), 0.18 * Math.sin(a * 0.55)] }; };
    const curve = (a) => { const { mid, tip } = shape(a), P0 = B0, P1 = add(B0, [0, -0.45, 0]), P3 = tip; return (t) => { const u1 = 1 - t; if (t < 0.5) { const v = t / 0.5, w = 1 - v; return add(add(mul(P0, w * w), mul(P1, 2 * v * w)), mul(mid, v * v)); } const v = (t - 0.5) / 0.5, w = 1 - v, c2 = add(mid, sub(mid, P1)); return add(add(mul(mid, w * w), mul(lerp3(c2, P3, 0.3), 2 * v * w)), mul(P3, v * v)); }; };
    SC.push({
      title: 'Collaborative magnetic manipulation', cam: { az: 0.05, el: 0.22, dist: 7.6, tgt: [0, 0.05, 0] },
      base: [-1.95, -0.95, -0.35], base2: [1.95, -0.95, -0.35],
      pieces: [ellP([0, 0, 0], 1.05, 0.95, 0.9, { skip: (p) => p[1] > 0.85 && Math.hypot(p[0], p[2]) < 0.16 }), tubeP(buildTube([[0, 1.75, 0.05], [0, 1.3, 0.05], [0, 0.9, 0.05]], 6), () => 0.13)],
      arm(a) { const { mid } = shape(a), p = add(mid, [-1.15, 0.4, 0.4]); return { p, dir: nrm(sub(mid, p)), dev: mid }; },
      arm2(a) { const { tip } = shape(a), p = add(tip, [1.15, 0.3, 0.4]); return { p, dir: nrm(sub(tip, p)), dev: tip }; },
      dev(a, D) { const c = curve(a); for (let t = 0; t <= 1.0001; t += 0.012) D.dot(c(t), t > 0.4 ? 4.2 : 3.4, t > 0.4 ? 2 : 0); },
    });
  }
  { // Low-cost endoscope for gastric cancer screening — oesophagus → stomach, retroflexion
    const st = buildTube([[-0.35, 2.1, 0], [-0.35, 1.2, 0.02], [-0.2, 0.55, 0.05], [0.05, -0.2, 0.05], [0.55, -0.75, 0], [1.2, -0.7, -0.05], [1.6, -0.25, -0.05], [1.75, 0.15, -0.05]], 14);
    const rf = (u) => (u < 0.22 ? 0.13 : u > 0.93 ? 0.16 : 0.13 + 0.62 * Math.pow(Math.sin(PI * cl((u - 0.22) / 0.74)), 0.75));
    const dep = (a) => st.len * lerp(0.05, 0.48, MOVE(cl(a / 2.4))), bend = (a) => 2.9 * MOVE(cl((a - 2.2) / 2.2));
    const scope = (a) => {
      const L = dep(a), pts = []; for (let q = 0; q <= L; q += 0.05) pts.push(st.at(q).p);
      const f = st.at(L); let p = f.p, t = f.t, n = nrm(sub([-1, 0.6, 0.15], mul(t, dot([-1, 0.6, 0.15], t)))); const th = bend(a), NB = 16, seg = 0.55 / NB;
      for (let k = 0; k < NB; k++) { const d = th / NB, c = Math.cos(d), s1 = Math.sin(d), t2 = add(mul(t, c), mul(n, s1)); n = add(mul(t, -s1), mul(n, c)); t = t2; p = add(p, mul(t, seg)); pts.push(p); }
      return { pts, tip: p, dir: t };
    };
    SC.push({
      title: 'Gastric cancer screening', cam: { az: -0.2, el: 0.1, dist: 5.8, tgt: [0.55, 0.45, 0] },
      pieces: [tubeP(st, rf)],
      dev(a, D) {
        const { pts, tip, dir } = scope(a), n = pts.length;
        pts.forEach((p, k) => D.dot(p, 3.4, k > n - 12 ? 2 : 0));
        const b = basis(dir);
        for (let r = 1; r <= 4; r++) for (let k = 0; k < 10; k++) { const an = (k / 10) * 2 * PI + a, rr = 0.045 * r, q = add(add(tip, mul(dir, 0.1 * r)), add(mul(b[0], rr * Math.cos(an)), mul(b[1], rr * Math.sin(an)))); D.dot(q, 1.3, 2); }
      },
    });
  }
  { // Magnetic levitation laparoscopic camera — external magnet anchors and steers an internal camera
    const wall = (x, z) => 0.95 - 0.1 * (x * x + z * z * 1.6), org = (x, z) => -0.95 + 0.13 * Math.sin(2.1 * x + 0.4) * Math.cos(1.9 * z) + 0.07 * Math.sin(3.7 * x - 1.2 * z);
    let LP = [0, -0.9, 0];
    const st = (a) => { const x = 0.55 * Math.sin(a * 0.55), z = 0.25 * Math.sin(a * 0.8), th = 1.2 + 0.18 * Math.sin(a * 1.1), yw = a * 0.9 + 2; const cp = [x, wall(x, z) - 0.2, z], dir = nrm([Math.cos(yw) * Math.cos(th), -Math.sin(th), Math.sin(yw) * Math.cos(th)]); return { cp, dir, mp: [x, wall(x, z) + 0.2, z] }; };
    SC.push({
      title: 'Magnetic levitation camera', cam: { az: -0.55, el: 0.12, dist: 5.4, tgt: [0.2, 0.05, 0] },
      pieces: [planeP(-1.9, 1.9, -1.2, 1.2, wall, { bright: true }), planeP(-1.9, 1.9, -1.2, 1.2, org, { bright: true })],
      pre(a) { const { cp, dir } = st(a); let t = 0; for (let k = 0; k < 40; k++) { t += (cp[1] + dir[1] * t - org(cp[0] + dir[0] * t, cp[2] + dir[2] * t)) / Math.max(0.2, -dir[1]); } LP = add(cp, mul(dir, t)); },
      dev(a, D) {
        const { cp, dir, mp } = st(a);
        D.body(cp, dir);
        EXTM.forEach((m, i) => D.dot(add(mp, [m[0], m[1], m[2]]), 2.4, m[1] > 0 ? 2 : 0, [m[3], m[4], m[5]]));
        for (let k = 0; k < 6; k++) { const t = (a * 0.9 + k / 6) % 1; D.dot(lerp3(mp, cp, t), 2.4, 2); }
        const b = basis(dir); for (let r = 1; r <= 5; r++) for (let k = 0; k < 8; k++) { const an = (k / 8) * 2 * PI - a, q = lerp3(add(cp, mul(dir, 0.22)), LP, r / 6); D.dot(add(q, add(mul(b[0], 0.03 * r * Math.cos(an)), mul(b[1], 0.03 * r * Math.sin(an)))), 1.1, 2); }
      },
      hl(i, a, p, tg) { return tg === 1 && Math.hypot(p[0] - LP[0], p[2] - LP[2]) < 0.42; },
    });
  }
  const ORDER = ['Magnetic flexible endoscopy', 'Aerosol jet printing', 'Magnetic tentacles', 'Hexapod positioning', 'Collaborative magnetic manipulation', 'MRI actuated instruments', 'Magnetic levitation camera', 'Tendon-driven continuum robots', 'Gastric cancer screening', 'Magnetic vine robots', 'Autonomy in surgical robotics', 'Magnetically guided ultrasound'];
  SC.splice(0, SC.length, ...ORDER.map((t) => SC.find((x) => x.title === t)).filter(Boolean));
  SC.forEach((s) => { Object.assign(s, sample(s.pieces)); if (s.prep) s.prep(s.P); if (s.psm) s.psm.forEach((m) => { const c = Math.cos(m.yaw), sn = Math.sin(m.yaw); const tc = Math.cos(-0.7), ts = Math.sin(-0.7); m.W = mm(mm([c, 0, sn, 0, 1, 0, -sn, 0, c], [1, 0, 0, 0, tc, -ts, 0, ts, tc]), [1, 0, 0, 0, 0, 1, 0, -1, 0]); }); });
  const SEEDS = [[0, 0.6, 0, -1.3, 0, 0.9, 0], [0, 0.6, 0, -1.3, 0, -0.9, 0], [1.2, 0.6, 0, -1.3, 0, 0.9, 0], [-1.2, 0.6, 0, -1.3, 0, 0.9, 0], [0, -0.6, 0, 1.3, 0, -0.9, 0], [1.6, 0.4, 0, -1.6, 0, 1.2, 0]];
  SC.forEach((s) => {
    if (!s.arm) return;
    s.tool = !!s.arm(0).tool;
    const off = (s.tool ? TOOL_L : MAG_L) + 0.02, w0 = s.arm(0);
    let best = null, be = 1e9;
    SEEDS.forEach((seed) => {
      const q = ik(seed.slice(), s.base, w0.p, w0.dir, off, 150), E0 = fk(q, s.base)[8], z = [E0.R[2], E0.R[5], E0.R[8]];
      const e = 4 * len3(sub(w0.p, add(E0.t, mul(z, off)))) + len3(sub(w0.dir, z)) + 0.05 * q.reduce((m, v, k) => m + Math.abs(v - REST[k]), 0);
      if (e < be) { be = e; best = q; }
    });
    let tr = [], q = best;
    for (let t = 0; t <= ASPAN + 1e-6; t += 0.1) { const w = s.arm(t); q = ik(q.slice(), s.base, w.p, w.dir, off, 25); tr.push(q); }
    for (let pass = 0; pass < 3; pass++) tr = tr.map((_, i) => { const r = [0, 0, 0, 0, 0, 0, 0]; let ws = 0; for (let d = -2; d <= 2; d++) { const kk = cl(i + d, 0, tr.length - 1), w = 3 - Math.abs(d); ws += w; for (let m = 0; m < 7; m++) r[m] += tr[kk][m] * w; } return r.map((v) => v / ws); });
    s.traj = tr;
    if (s.arm2) { const w1 = s.arm2(0); let b2 = null, e2 = 1e9; SEEDS.forEach((seed) => { const q = ik(seed.slice(), s.base2, w1.p, w1.dir, off, 150), E0 = fk(q, s.base2)[8], z = [E0.R[2], E0.R[5], E0.R[8]]; const e = 4 * len3(sub(w1.p, add(E0.t, mul(z, off)))) + len3(sub(w1.dir, z)); if (e < e2) { e2 = e; b2 = q; } }); let t2 = [], q2 = b2; for (let t = 0; t <= ASPAN + 1e-6; t += 0.1) { const w = s.arm2(t); q2 = ik(q2.slice(), s.base2, w.p, w.dir, off, 25); t2.push(q2); } for (let pass = 0; pass < 3; pass++) t2 = t2.map((_, i) => { const r = [0, 0, 0, 0, 0, 0, 0]; let ws = 0; for (let d = -2; d <= 2; d++) { const kk = cl(i + d, 0, t2.length - 1), w = 3 - Math.abs(d); ws += w; for (let m = 0; m < 7; m++) r[m] += t2[kk][m] * w; } return r.map((v) => v / ws); }); s.traj2 = t2; }
  });
  const qAt = (s, a, key) => { const tr = s[key || 'traj'], x = cl(a / 0.1, 0, tr.length - 1), i0 = Math.floor(x), i1 = Math.min(tr.length - 1, i0 + 1), f = x - i0; return tr[i0].map((v, k) => lerp(v, tr[i1][k], f)); };
  const HS = new Float32Array(N), HS2 = new Float32Array(N);
  for (let i = 0; i < N; i++) { HS[i] = hash(i, 1); HS2[i] = hash(i, 2); }
  const LIGHT = nrm([-0.5, 0.9, 0.6]);
  const CAPN = 16000;

  function makeState() {
    return { idx: 0, FROM: SC[0].P.slice(), FN: SC[0].Nn.slice(), CUR: SC[0].P.slice(), CN: SC[0].Nn.slice(), camFrom: { ...SC[0].cam }, camCur: { ...SC[0].cam },
      lastT: null,
      SX: new Float32Array(CAPN), SY: new Float32Array(CAPN), KEY: new Uint16Array(CAPN), ORD: new Int32Array(CAPN), CNT: new Int32Array(384) };
  }

  function render(c, T, S0) {
    const S_ = S0, first = T < SCENE, idx = Math.floor(T / SCENE) % SC.length, u = T % SCENE, sc = SC[idx];
    const dt = S_.lastT == null ? 0 : cl(T - S_.lastT, 0, 0.1); S_.lastT = T;
    if (idx !== S_.idx) { S_.FROM.set(S_.CUR); S_.FN.set(S_.CN); S_.camFrom = { ...S_.camCur }; S_.idx = idx; }
    const ce = first ? 1 : FADE(cl(u / MORPH)), cf = S_.camFrom, ct = sc.cam;
    const cm = { az: lerp(cf.az, ct.az, ce), el: lerp(cf.el, ct.el, ce), dist: lerp(cf.dist, ct.dist, ce), tgt: lerp3(cf.tgt, ct.tgt, ce) };
    S_.camCur = cm;
    const cyc = Math.floor(T / SCENE), TST = cyc % 5, TDIR = cyc % 2 ? 1 : -1, fl = first ? 0 : Math.sin(PI * ce);
    cm.dist += fl * 0.9;
    const az = cm.az + 0.18 * Math.sin((2 * PI * T) / 40) + fl * 0.55 * TDIR, el = cm.el + 0.03 * Math.sin((2 * PI * T) / 27) + fl * 0.12;
    const cam = add(cm.tgt, mul([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], cm.dist));
    const fw = nrm(sub(cm.tgt, cam)), rt = nrm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
    const a = (u - MORPH) * (ASPAN / (SCENE - MORPH)), A = rp(u, 0.9, 1.4) * (1 - rp(u, SCENE - 0.5, SCENE - 0.08));
    if (sc.pre) sc.pre(a);

    const { SX, SY, KEY, ORD, CNT } = S_; CNT.fill(0);
    let nd = 0;
    const put = (p, lvlBase, col, layer) => {
      if (nd >= CAPN) return;
      const vx = p[0] - cam[0], vy = p[1] - cam[1], vz = p[2] - cam[2], dz = Math.max(0.05, vx * fw[0] + vy * fw[1] + vz * fw[2]);
      const lvl = Math.max(1, Math.min(31, Math.round(lvlBase * (5.6 / dz) * 2.8)));
      SX[nd] = (FOC * (vx * rt[0] + vy * rt[1] + vz * rt[2])) / dz; SY[nd] = -(FOC * (vx * up[0] + vy * up[1] + vz * up[2])) / dz;
      const key = layer * 128 + col * 32 + lvl; KEY[nd] = key; CNT[key]++; nd++;
    };
    const dRef = dot(sub(cm.tgt, cam), fw) + 0.2, lay = (p) => (dot(sub(p, cam), fw) > dRef ? 0 : 1);
    const facing = (p, n) => n[0] * (cam[0] - p[0]) + n[1] * (cam[1] - p[1]) + n[2] * (cam[2] - p[2]) > 0;
    const shade = (n) => cl(0.3 + 0.7 * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));

    // anatomy
    const rev = first ? lerp(-3.4, 3.4, rp(T, 0, 1.9)) : 99, TP = sc.P, TN = sc.Nn, F = S_.FROM, FN = S_.FN, C = S_.CUR, CN = S_.CN;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      if (TP[j] > rev) continue;
      let tx = TP[j], ty = TP[j + 1], tz = TP[j + 2], tnx = TN[j], tny = TN[j + 1], tnz = TN[j + 2], dim = 0;
      if (sc.deform) { const r = sc.deform(i, Math.max(0, a)); if (r) { tx = r[0]; ty = r[1]; tz = r[2]; tnx = r[3]; tny = r[4]; tnz = r[5]; dim = r[6]; } }
      let e = 1, px = tx, py = ty, pz = tz, spark = false;
      if (!first) {
        const sw = cl((tx * rt[0] + tz * rt[2] + 3) / 6);
        e = TST === 2 ? MOVE(cl((u - sw * 0.5) / 0.75)) : MOVE(cl((u - HS[i] * 0.4) / 0.85));
        const w = Math.sin(PI * e), fx = F[j], fy = F[j + 1], fz = F[j + 2], h2 = HS2[i];
        px = lerp(fx, tx, e); py = lerp(fy, ty, e); pz = lerp(fz, tz, e);
        if (TST === 0) { const an = w * (1.1 + 1.6 * h2) * TDIR, c = Math.cos(an), sn = Math.sin(an), x0 = px, z0 = pz; px = x0 * c - z0 * sn; pz = x0 * sn + z0 * c; py += w * 0.3 * (h2 - 0.5); }
        else if (TST === 1) { const r = Math.hypot(px, py, pz) || 1, k = (w * (0.8 + 1.6 * h2)) / r; px += px * k; py += py * k; pz += pz * k; }
        else if (TST === 2) { py += w * (0.45 + 0.9 * h2); px += w * 0.25 * TDIR; }
        else if (TST === 3) { const th = HS[i] * 2 * PI * 7 + T * 0.7 * TDIR, ph = Math.acos(2 * h2 - 1), Rr = 1.45, b = 2 * e * (1 - e), a2 = (1 - e) * (1 - e), c2 = e * e; px = a2 * fx + b * Rr * Math.sin(ph) * Math.cos(th) + c2 * tx; py = a2 * fy + b * Rr * Math.cos(ph) + c2 * ty; pz = a2 * fz + b * Rr * Math.sin(ph) * Math.sin(th) + c2 * tz; }
        else { const cy = Math.max(fy, ty) + 1.1 + 1.3 * h2, b = 2 * e * (1 - e); py = (1 - e) * (1 - e) * fy + b * cy + e * e * ty; }
        spark = w > 0.45 && h2 > 0.88;
      }
      const nx = lerp(FN[j], tnx, e), ny = lerp(FN[j + 1], tny, e), nz = lerp(FN[j + 2], tnz, e);
      C[j] = px; C[j + 1] = py; C[j + 2] = pz; CN[j] = nx; CN[j + 1] = ny; CN[j + 2] = nz;
      const vx = px - cam[0], vy = py - cam[1], vz = pz - cam[2];
      const front = !sc.BR[i] && -(nx * vx + ny * vy + nz * vz) > 0, sg = front ? 1 : -1;
      const sh = sc.BR[i] ? cl(0.35 + 0.6 * (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])) : cl((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) * sg * 1.1 + (front ? -0.05 : 0.15));
      const base = front ? 0.7 + 3.4 * Math.pow(sh, 1.6) : 0.9 + 5.2 * Math.pow(sh, 1.5);
      let col = front ? 1 : 0;
      if ((first && rev - TP[j] < 0.22) || spark) col = 2;
      else if (sc.hl && u > MORPH && A > 0.3 && e >= 1 && sc.hl(i, a, [px, py, pz], sc.TG[i])) col = 2;
      if (dim === 2) continue;
      if (dim) { put([px, py, pz], 0.9, 1, 0); continue; }
      put([px, py, pz], base, col, front && !sc.onTop ? 1 : 0);
    }

    // arm: pre-solved joint trajectory; blends between consecutive arm scenes, dissolves otherwise
    const has = !!sc.traj, prev = SC[(idx + SC.length - 1) % SC.length], pHas = !first && !!prev.traj;
    let q = null, base = null, tool = 0, armA = 0, E = null, ez = [0, 0, 1], magA = 0;
    if (has) {
      q = qAt(sc, Math.max(0, a)); base = sc.base; tool = sc.tool ? 1 : 0;
      armA = first ? rp(T, 1.0, 2.4) : pHas ? 1 : rp(u, 0.45, 1.35);
      if (pHas) { const eb = FADE(cl(u / MORPH)), q0 = qAt(prev, 99); q = q0.map((v, k2) => lerp(v, q[k2], eb)); base = lerp3(prev.base, sc.base, eb); tool = lerp(prev.tool ? 1 : 0, tool, eb); }
    } else if (pHas) { q = qAt(prev, 99); base = prev.base; tool = prev.tool ? 1 : 0; armA = 1 - rp(u, 0, 0.8); }
    const want = has ? sc.arm(Math.max(0, a)) : {};
    const drawArm = (q, base, tool, armA, salt) => {
      const Fk = fk(q, base), E = Fk[8];
      if (ARM) for (let L = 0; L < 8; L++) {
        const { P, Nn, n } = ARM[L], R = Fk[L].R, t = Fk[L].t;
        for (let i = 0; i < n; i++) {
          if (hash(L * 997 + i + salt, 5) > armA) continue;
          const j = i * 3, p = add(mv(R, [P[j], P[j + 1], P[j + 2]]), t), nw = mv(R, [Nn[j], Nn[j + 1], Nn[j + 2]]);
          if (!facing(p, nw)) continue;
          put(p, 0.9 + 2.9 * Math.pow(shade(nw), 1.5), 0, lay(p));
        }
      }
      const ez = [E.R[2], E.R[5], E.R[8]], magA = armA * (1 - tool), toolA = armA * tool;
      MAG.forEach((m, i) => { if (hash(i + salt, 7) > magA) return; const p = add(E.t, mv(E.R, m)), nw = mv(E.R, [m[3], m[4], m[5]]); if (!facing(p, nw)) return; put(p, 1.1 + 2.8 * Math.pow(shade(nw), 1.3), m[6] ? 0 : m[0] > 0 ? 2 : 0, lay(p)); });
      for (let qq = 0, i = 0; qq <= TOOL_L; qq += 0.022, i++) if (hash(i, 8) < toolA) put(add(E.t, mul(ez, qq)), qq > TOOL_L - 0.05 ? 4 : 2.4, qq > TOOL_L - 0.05 ? 2 : 0, 1);
      return { E, ez, magA };
    };
    if (q && armA > 0.001) { const r = drawArm(q, base, tool, armA, 0); E = r.E; ez = r.ez; magA = r.magA; }
    const has2 = !!sc.traj2, pHas2 = !first && !!prev.traj2, want2 = has2 ? sc.arm2(Math.max(0, a)) : {};
    let E2 = null, ez2 = null, magA2 = 0;
    if (has2 || pHas2) {
      const src = has2 ? sc : prev, aA = has2 ? (first ? rp(T, 1.0, 2.4) : rp(u, 0.45, 1.35)) : 1 - rp(u, 0, 0.8);
      if (aA > 0.001) { const r = drawArm(qAt(src, has2 ? Math.max(0, a) : 99, 'traj2'), src.base2, 0, aA, 313); E2 = r.E; ez2 = r.ez; magA2 = r.magA; }
    }

    // dVRK patient-side manipulators
    if (sc.psm && PSMD) {
      const pa = first ? rp(T, 1.0, 2.4) : rp(u, 0.4, 1.3) * (1 - rp(u, SCENE - 0.6, SCENE - 0.1));
      if (pa > 0.001) sc.psm.forEach((m, ai) => {
        const tip = m.tip(Math.max(0, a)), W = m.W, dw = sub(tip, m.rcm);
        const b = [W[0] * dw[0] + W[3] * dw[1] + W[6] * dw[2], W[1] * dw[0] + W[4] * dw[1] + W[7] * dw[2], W[2] * dw[0] + W[5] * dw[1] + W[8] * dw[2]];
        const q3 = cl(len3(b) / PSM_S, 0.02, 0.24), bn = nrm(b), q2 = cl(Math.asin(cl(-bn[1], -1, 1)), -0.78, 0.78), q1 = cl(Math.atan2(bn[0], -bn[2]), -1.5, 1.5);
        const Fp = psmFK(q1, q2, q3), toW = (p) => add(m.rcm, mv(W, mul(p, PSM_S)));
        PSM_LINKS.forEach(([key, fr, dens], li) => {
          const L = PSMD[key]; if (!L) return; const F = Fp[fr];
          for (let i = 0; i < L.n; i++) {
            if (hash(li * 7919 + i + ai * 131, 5) > pa * dens) continue;
            const j = i * 3, pl = add(mv(F.R, [L.P[j], L.P[j + 1], L.P[j + 2]]), F.t), p = toW(pl), nw = mv(W, mv(F.R, [L.Nn[j], L.Nn[j + 1], L.Nn[j + 2]]));
            if (!facing(p, nw)) continue;
            put(p, 0.8 + 2.6 * Math.pow(shade(nw), 1.4), 0, lay(p));
          }
        });
        const A0 = toW(Fp.ad.t), zt = mv(W, [Fp.ad.R[2], Fp.ad.R[5], Fp.ad.R[8]]), TIP = add(m.rcm, mul(zt, q3 * PSM_S));
        for (let qq = 0, n = len3(sub(TIP, A0)), i = 0; qq < n; qq += 0.028, i++) if (hash(i + ai * 97, 17) < pa) put(add(A0, mul(zt, qq)), 1.9, 0, 1);
        if (pa > 0.5) { const ob = basis(zt)[0], op = 0.035 + (m.main ? 0.02 * Math.sin(T * 5) : 0.01); [-1, 1].forEach((sg) => { for (let k = 1; k <= 3; k++) put(add(add(TIP, mul(zt, 0.03 * k)), mul(ob, sg * op * k / 3)), 2.6, 2, 1); }); }
        put(m.rcm, 2.2, 2, 1);
      });
    }
    // devices
    let di = 0;
    const D = {
      dot: (p, lv, col, n) => { di++; if (hash(di, 9) > A) return; if (n && !facing(p, n)) return; put(p, lv || 1.3, col, 2); },
      oloid: (cp, t, ang) => { const b = basis(t), c = Math.cos(ang), s1 = Math.sin(ang); OLO.forEach((m, i) => { if (hash(i, 12) > A) return; const rot = (v) => { const y = v[1] * c - v[2] * s1, z = v[1] * s1 + v[2] * c; return add(add(mul(b[0], v[0]), mul(b[1], y)), mul(t, z)); }; const p = add(cp, rot(m)), nw = rot([m[3], m[4], m[5]]); if (!facing(p, nw)) return; put(p, 1 + 2.6 * shade(nw), m[0] < -0.04 ? 2 : 0, 2); }); },
      body: (cp, t) => { const b = basis(t), R = [b[0][0], b[1][0], t[0], b[0][1], b[1][1], t[1], b[0][2], b[1][2], t[2]]; CAP.forEach((m, i) => { if (hash(i, 11) > A) return; const p = add(cp, mv(R, m)), nw = mv(R, [m[3], m[4], m[5]]); if (!facing(p, nw)) return; put(p, 0.8 + 2.4 * shade(nw), m[2] > -0.05 && m[2] < 0.06 ? 0 : 2, 1); }); },
    };
    if (A > 0.001 && sc.dev) sc.dev(Math.max(0, a), D);

    // magnetic field: flowing particles from magnet face to device
    const drawField = (E, ez, magA, tip, salt) => {
      const M0 = add(E.t, mul(ez, MAG_L + 0.02)), side = nrm(cross(sub(tip, M0), fw));
      for (let kk = -2; kk <= 2; kk++) {
        const ctrl = add(lerp3(M0, tip, 0.5), mul(side, kk * 0.2));
        const bz = (t) => add(add(mul(M0, (1 - t) * (1 - t)), mul(ctrl, 2 * t * (1 - t))), mul(tip, t * t));
        for (let j = 1; j < 14; j++) if (hash(kk * 31 + j + salt, 13) < A * 0.8) put(bz(j / 14), 0.9, 1, 1);
        for (let qq = 0; qq < 4; qq++) { const t = (T * 0.45 + qq / 4 + (kk + 2) * 0.11 + salt * 0.01) % 1; if (A > 0.2) put(bz(t), 2.8, 2, 1); }
      }
    };
    if (has && E && want.dev && magA > 0.3 && A > 0.001) drawField(E, ez, magA, want.dev, 0);
    if (has2 && E2 && want2.dev && magA2 > 0.3 && A > 0.001) drawField(E2, ez2, magA2, want2.dev, 17);

    // draw buckets: layer 0 (behind) then 1 (front)
    for (let kx = 1; kx < 384; kx++) CNT[kx] += CNT[kx - 1];
    for (let d = nd - 1; d >= 0; d--) ORD[--CNT[KEY[d]]] = d;
    c.lineCap = 'round';
    let p = 0;
    while (p < nd) {
      const key = KEY[ORD[p]], col = (key % 128) >> 5, lv = key & 31;
      c.beginPath();
      while (p < nd && KEY[ORD[p]] === key) { const d = ORD[p++]; c.moveTo(SX[d], SY[d]); c.lineTo(SX[d] + 0.01, SY[d]); }
      c.strokeStyle = col === 2 ? YEL : '#fff'; c.globalAlpha = col === 2 ? 1 : col === 0 ? 0.9 : 0.45; c.lineWidth = lv / 2; c.stroke();
    }
    c.globalAlpha = 1; c.lineCap = 'butt';
    return { idx, p: cl(u / SCENE) };
  }

  // ── Site wrapper (replaces the design's React component) ──────────────────
  var cv = document.getElementById('research-hero');
  if (!cv || !cv.getContext) return;
  var focusX = 0.68; // design setting "Animation horizontal position"
  var ctx = cv.getContext('2d'), ST = makeState();
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T = reduce ? SCENE * SC.length + 3.8 : 0, raf = 0, last = null, inView = true, s = 1, dpr = 1, cw = 1, ch = 1;
  var draw = function () {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    var fx = cw < 760 ? 0.5 : cw < 1100 ? Math.max(focusX, 0.74) : focusX;
    // Phones: the scene gets its own band above the copy (see .page-hero--anim in _layout.scss).
    var cy = cw < 600 ? 190 : ch * 0.5;
    ctx.setTransform(s * dpr, 0, 0, s * dpr, cw * fx * dpr, cy * dpr);
    render(ctx, T, ST);
  };
  var size = function () {
    cw = cv.clientWidth || 1; ch = cv.clientHeight || 1; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    s = Math.min((ch / H) * 1.3, ((cw < 760 ? cw * 1.1 : cw * 0.82) / 1920) * 1.35);
    draw();
  };
  var tick = function (ts) { if (last == null) last = ts; T += Math.min(0.1, (ts - last) / 1000); last = ts; draw(); raf = requestAnimationFrame(tick); };
  var start = function () { if (reduce || raf || !inView || document.hidden) return; last = null; raf = requestAnimationFrame(tick); };
  var stop = function () { cancelAnimationFrame(raf); raf = 0; };
  if (window.ResizeObserver) new ResizeObserver(size).observe(cv); else window.addEventListener('resize', size);
  size();
  // The point clouds arrive asynchronously; redraw a still frame once they have.
  if (reduce) { var tries = 0, poll = setInterval(function () { draw(); if (++tries > 40 || (ARM && PSMD)) { clearInterval(poll); draw(); } }, 250); return; }
  if (window.IntersectionObserver) new IntersectionObserver(function (e) { inView = e[0].isIntersecting; if (inView) start(); else stop(); }).observe(cv);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  start();
})();
