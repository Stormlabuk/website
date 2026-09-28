/* MRI actuated instruments — research hero animation (ES module, WebGL).
   Port of the Claude Design "MRI Actuation Hero v4" scene: an MRI scanner in
   halftone dots (cutaway), streaming B0 field lines, gradient coils firing,
   the patient's vessels, a live MR slice, and a magnetic bead steered by the
   gradients along the vessel to a lesion — 40 s loop. Uses the self-hosted
   Three.js build in /assets/vendor/three. Pauses off-screen / in background
   tabs; still frame under prefers-reduced-motion; degrades to the plain dark
   hero if WebGL is unavailable. */
import * as THREE from '../vendor/three/three.module.min.js';

const mount = document.getElementById('mri-hero');
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (mount) { try { init(); } catch (e) { console.warn('MRI hero unavailable:', e); } }

function init() {
  // Design settings used on the page: speed 1, cutaway on, scene offset 0.17.
  const SPEED = 1, CUT = true, OFFSET = 0.17;
  const STILL_T = 30; // representative frame for reduced motion

  const LOOP = 40;
  const YEL = new THREE.Color(0xF8CD04);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0A0A0A, 1);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 21 / 9, 0.05, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(2, 3, 4); scene.add(dl);

  const uScale = { value: 400 }, uMax = { value: 5 * renderer.getPixelRatio() };
  const VS = `attribute vec3 aCol; attribute float aSize; uniform float uScale; uniform float uOpacity; uniform float uMax; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
    gl_PointSize = clamp(aSize * uScale / d, 1.2, uMax); vC = aCol; vA = uOpacity * (1.0 - smoothstep(6.5, 17.0, d)) * smoothstep(0.5, 1.4, d); }`;
  const FS = `varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = 1.0 - smoothstep(0.32, 0.5, r); if (a <= 0.0) discard; gl_FragColor = vec4(vC, a * vA); }`;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const DB = () => ({ p: [], c: [], s: [], d: [], add(v, col, size, dd = 0) { this.p.push(v.x, v.y, v.z); if (typeof col === 'number') this.c.push(col, col, col); else this.c.push(col.r, col.g, col.b); this.s.push(size); this.d.push(dd); } });
  const mk = (b, op = 1) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(b.c, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(b.s, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uScale, uMax, uOpacity: { value: op } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.d = Float32Array.from(b.d); scene.add(pts); return pts;
  };
  const sampleLine = (pts, sp, cb, d0 = 0) => { let s = d0, carry = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = a.distanceTo(b); let t = carry; while (t < L) { cb(a.clone().lerp(b, t / L), s + t); t += sp; } carry = t - L; s += L; } return s; };

  const D = Math.PI / 180, CUT0 = 10 * D, CUT1 = 100 * D;
  const inCut = (p) => { const a = ((p % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return a > CUT0 && a < CUT1; };
  const cyl = (r, phi, z) => V(r * Math.cos(phi), r * Math.sin(phi), z);

  // ── Scanner as halftone dots ──────────────────────────────────────────────
  const buildScanner = (cut) => {
    const b = DB();
    const cylSurf = (r, z0, z1, sp, br, sz) => { let row = 0; for (let z = z0; z <= z1 + 1e-6; z += sp, row++) { const n = Math.round(2 * Math.PI * r / sp); for (let k = 0; k < n; k++) { const phi = (k + (row % 2) * 0.5) * 2 * Math.PI / n; if (cut && inCut(phi)) continue; b.add(cyl(r, phi, z), br, sz); } } };
    const annulus = (r0, r1, z, sp, br, sz) => { let row = 0; for (let r = r0; r <= r1 + 1e-6; r += sp, row++) { const n = Math.round(2 * Math.PI * r / sp); for (let k = 0; k < n; k++) { const phi = (k + (row % 2) * 0.5) * 2 * Math.PI / n; if (cut && inCut(phi)) continue; b.add(cyl(r, phi, z), br, sz); } } };
    cylSurf(0.6, -1.3, 1.3, 0.05, 0.2, 0.016);
    cylSurf(1.85, -1.3, 1.3, 0.075, 0.3, 0.024);
    annulus(0.66, 1.78, 1.42, 0.06, 0.32, 0.02);
    annulus(0.66, 1.78, -1.42, 0.06, 0.32, 0.02);
    if (cut) [CUT0, CUT1].forEach(phi => { let row = 0; for (let r = 0.6; r <= 1.85; r += 0.045, row++) for (let z = -1.42 + (row % 2) * 0.0225; z <= 1.42; z += 0.045) b.add(cyl(r, phi, z), 0.42, 0.018); });
    return mk(b, 1);
  };
  const scanCut = buildScanner(true), scanFull = buildScanner(false);

  const floor = DB();
  for (let x = -6; x <= 6; x += 0.16) for (let z = -6; z <= 6; z += 0.16) floor.add(V(x, -1.86, z), 0.24, 0.032);
  mk(floor, 1);

  const table = DB();
  const boxEdges = (x0, x1, y0, y1, z0, z1) => { const c = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)], e = [V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)]; [c, e].forEach(q => sampleLine([...q, q[0]], 0.035, p => table.add(p, 0.45, 0.016))); for (let i = 0; i < 4; i++) sampleLine([c[i], e[i]], 0.035, p => table.add(p, 0.45, 0.016)); };
  boxEdges(-0.32, 0.32, -0.5, -0.42, -1.7, 3.6);
  boxEdges(-0.22, 0.22, -1.86, -0.5, 2.7, 3.3);
  boxEdges(-1.3, 1.3, -1.86, -1.7, -1.1, 1.1);
  mk(table, 1);

  // ── Gradient coils (fingerprint saddles for X/Y, opposed rings for Z) ─────
  const coilB = [DB(), DB(), DB()];
  const fingerprint = (b, r, pc, zc, sign) => {
    let dd = 0;
    for (let k = 0; k < 5; k++) {
      const w = 0.42 - k * 0.075, hz = 0.34 - k * 0.062, pts = [];
      for (let i = 0; i <= 160; i++) { const t = i / 160 * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t); const u = w * Math.sign(c) * Math.pow(Math.abs(c), 0.35), v = hz * Math.sign(s) * Math.pow(Math.abs(s), 0.35); pts.push(cyl(r, pc + u / r, zc + v)); }
      dd = sampleLine(pts, 0.014, (p, s) => b.add(p, 0.26, 0.011, s * sign), dd);
    }
  };
  [[0, 1], [Math.PI, -1]].forEach(([pc, sg]) => [0.52, -0.52].forEach(zc => fingerprint(coilB[0], 0.72, pc, zc, sg * Math.sign(zc))));
  [[Math.PI / 2, 1], [-Math.PI / 2, -1]].forEach(([pc, sg]) => [0.52, -0.52].forEach(zc => fingerprint(coilB[1], 0.76, pc, zc, sg * Math.sign(zc))));
  [0.28, 0.42, 0.56, 0.7, 0.84, 0.98].forEach(z => [z, -z].forEach(zz => { const pts = []; for (let i = 0; i <= 120; i++) pts.push(cyl(0.68, i / 120 * 2 * Math.PI, zz)); sampleLine(pts, 0.014, (p, s) => coilB[2].add(p, 0.26, 0.011, s * Math.sign(zz))); }));
  const coils = coilB.map(b => mk(b, 1));
  const cw = [0, 0, 0], csign = [1, 1, 1], cphase = [0, 0, 0];

  // ── B0 field lines as streaming dots ──────────────────────────────────────
  const fCurves = [];
  [[0.12, 2.3], [0.3, 2.8], [0.48, 3.4]].forEach(([a, Rr], li) => { for (let k = 0; k < 10; k++) { const phi = (k * 36 + li * 12) * D; const pz = [[a, 0], [a, 1.6], [a * 1.3 + 0.35, 2.7], [Rr * 0.7, 3.25], [Rr, 1.8], [Rr * 1.05, 0], [Rr, -1.8], [Rr * 0.7, -3.25], [a * 1.3 + 0.35, -2.7], [a, -1.6]]; fCurves.push({ c: new THREE.CatmullRomCurve3(pz.map(([r, z]) => cyl(r, phi, z)), true, 'centripetal'), delay: k * 0.12 + li * 0.35 }); } });
  const FPC = 110, fb = DB(); for (let i = 0; i < fCurves.length * FPC; i++) fb.add(V(0, 0, 0), 0, 0.02);
  const fieldPts = mk(fb, 1);
  const fLUT = fCurves.map(f => f.c.getSpacedPoints(600));

  // ── Gradient visualiser sheet ─────────────────────────────────────────────
  const NA = 40, NZ = 96, sb = DB(); for (let i = 0; i < NA * NZ; i++) sb.add(V(0, 0, 0), 0, 0.013);
  const sheet = mk(sb, 0);

  // ── Patient + vessels ─────────────────────────────────────────────────────
  const BC = V(0, -0.25, 0.5), BR = V(0.3, 0.16, 1.3);
  const bodyB = DB();
  for (let k = -14; k <= 14; k++) { const th = k / 14 * Math.PI / 2, f = Math.cos(th), z = BC.z + BR.z * Math.sin(th), n = Math.max(6, Math.round(52 * f)); for (let i = 0; i < n; i++) { const a = (i + (k % 2) * 0.5) / n * 2 * Math.PI; bodyB.add(V(BC.x + BR.x * f * Math.cos(a), BC.y + BR.y * f * Math.sin(a), z), 0.22, 0.012); } }
  const body = mk(bodyB, 0);
  const mainC = new THREE.CatmullRomCurve3([V(0.12, -0.3, 1.3), V(0.1, -0.27, 1.0), V(0.03, -0.23, 0.7), V(-0.06, -0.21, 0.4), V(-0.05, -0.19, 0.15), V(0.04, -0.2, -0.1), V(0.1, -0.24, -0.3), V(0.1, -0.26, -0.45)], false, 'centripetal');
  const br1 = new THREE.CatmullRomCurve3([mainC.getPointAt(0.35), V(-0.14, -0.2, 0.52), V(-0.2, -0.17, 0.32)], false, 'centripetal');
  const br2 = new THREE.CatmullRomCurve3([mainC.getPointAt(0.72), V(-0.06, -0.22, -0.18), V(-0.13, -0.26, -0.38)], false, 'centripetal');
  const vesselR = 0.03, vB = DB();
  [[mainC, vesselR, 130], [br1, vesselR * 0.8, 30], [br2, vesselR * 0.8, 30]].forEach(([c, r, M]) => { const fr = c.computeFrenetFrames(M, false); for (let i = 0; i <= M; i++) { const p = c.getPointAt(i / M); for (let j = 0; j < 10; j++) { const a = (j + (i % 2) * 0.5) / 10 * 2 * Math.PI; vB.add(p.clone().addScaledVector(fr.normals[i], r * Math.cos(a)).addScaledVector(fr.binormals[i], r * Math.sin(a)), 0.5, 0.008); } } });
  const vessels = mk(vB, 0);
  const vSamples = [mainC, br1, br2].map(c => c.getSpacedPoints(300));
  const TARGET = mainC.getPointAt(1).clone().add(V(0, 0, -0.035));

  const lb = DB(); for (let i = 0; i < 90; i++) { const y = 1 - 2 * (i + 0.5) / 90, r = Math.sqrt(1 - y * y), a = i * 2.39996; lb.add(V(r * Math.cos(a) * 0.045, y * 0.045, r * Math.sin(a) * 0.045), 1, 0.012); }
  const lesion = mk(lb, 0); lesion.position.copy(TARGET);
  const rings = [0, 1, 2].map(() => { const b = DB(); for (let i = 0; i < 72; i++) { const a = i / 72 * 2 * Math.PI; b.add(V(Math.cos(a), Math.sin(a), 0), YEL, 0.012); } const r = mk(b, 0); r.position.copy(TARGET); return r; });

  // ── MR slice ──────────────────────────────────────────────────────────────
  const N = 64, PW = 0.84, PX0 = -PW / 2, PY0 = BC.y + PW / 2;
  const slb = DB(), noise = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { slb.add(V(PX0 + (i + 0.5) * PW / N, PY0 - (j + 0.5) * PW / N, 0), 0, 0.012); noise[j * N + i] = Math.random(); }
  const slice = mk(slb, 0); const sPos = slice.geometry.attributes.position.array, sCol = slice.geometry.attributes.aCol.array;

  // ── Device ────────────────────────────────────────────────────────────────
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshLambertMaterial({ color: 0xF8CD04, emissive: 0x3a3000 }));
  scene.add(sphere);
  const fArrow = new THREE.ArrowHelper(V(1, 0, 0), V(), 0.2, 0xF8CD04, 0.045, 0.028); scene.add(fArrow);
  const tb = DB(); const tPts = mainC.getSpacedPoints(420); tPts.forEach(p => tb.add(p, YEL, 0.011));
  const tether = mk(tb, 0);

  const ss = (t, a, b) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const win = (t, a, b, e = 0.45) => ss(t, a - e, a + e) * (1 - ss(t, b - e, b + e));
  const uAt = (t) => 0.45 * ss(t, 17.8, 22.2) + 0.33 * ss(t, 23, 27.4) + 0.07 * ss(t, 28, 31) + 0.15 * ss(t, 31.6, 34.6);

  // Camera keyframes: [t, azimuth, elevation, distance, target x, y, z]
  const K = [
    [0, 0.95, 0.22, 8.4, 0, -0.1, 0],
    [5.5, 0.78, 0.3, 4.6, 0, 0, 0.1],
    [9.5, 0.62, 0.36, 3.7, 0, 0, 0.05],
    [12.9, 0.86, 0.4, 3.8, 0, -0.05, 0.2],
    [16.5, 0.5, 0.32, 3.2, 0, -0.2, 0.4],
    [22, 0.32, 0.32, 2.6, 0.05, -0.2, 0.7],
    [28, 0.62, 0.44, 2.6, 0.05, -0.2, 0.1],
    [34.5, 0.42, 0.32, 2.2, 0.08, -0.23, -0.3],
    [40, 0.95, 0.22, 8.4, 0, -0.1, 0]
  ];
  const n = K.length - 1;
  const key = (j) => { if (j < 0) { const k = K[j + n].slice(); k[0] -= LOOP; return k; } if (j > n) { const k = K[j - n].slice(); k[0] += LOOP; return k; } return K[j]; };
  const camAt = (t) => {
    let i = 0; while (i < n - 1 && t >= K[i + 1][0]) i++;
    const A = key(i), B = key(i + 1), P = key(i - 1), Nn = key(i + 2), h = B[0] - A[0], u = (t - A[0]) / h;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2, out = [];
    for (let c = 1; c < 7; c++) { const m0 = (B[c] - P[c]) / (B[0] - P[0]) * h, m1 = (Nn[c] - A[c]) / (Nn[0] - A[0]) * h; out.push(h00 * A[c] + h10 * m0 + h01 * B[c] + h11 * m1); }
    return out;
  };

  const resize = () => {
    const w = mount.clientWidth, h = mount.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.6 ? 40 : 30;
    // Portrait (phones): centre the scene and lift it above the full-width title.
    const portrait = w / h < 1;
    camera.setViewOffset(w, h, portrait ? 0 : -w * OFFSET, portrait ? h * 0.2 : 0, w, h); camera.updateProjectionMatrix();
    uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * D / 2));
    if (!raf) renderer.render(scene, camera); // keep a paused / still frame correct after resizing
  };

  const gS = V(0, 0, 0), ISO = V(0, 0, 0);
  let sheetOp = 0, sheetTheta = 0, fwS = 0;
  let clock = 0, elapsed = 0;

  // One simulation step of dt seconds (the design's per-frame update, verbatim).
  const update = (dt) => {
    clock += dt * SPEED; elapsed += dt;
    const T = clock % LOOP;
    const intro = reduce ? 1 : ss(elapsed, 0, 1.4);
    const fOut = 1 - ss(T, 38, 39.8);
    scanCut.visible = CUT; scanFull.visible = !CUT;
    scanCut.material.uniforms.uOpacity.value = scanFull.material.uniforms.uOpacity.value = intro;

    const [az, el, d, tx, ty, tz] = camAt(T);
    camera.position.set(tx + d * Math.sin(az) * Math.cos(el), ty + d * Math.sin(el), tz + d * Math.cos(az) * Math.cos(el));
    camera.lookAt(tx, ty, tz);

    // Field lines
    const fp = fieldPts.geometry.attributes.position.array, fc = fieldPts.geometry.attributes.aCol.array;
    const fBr = (0.3 + 0.6 * (1 - ss(T, 5.5, 7.5))) * fOut * intro;
    fCurves.forEach((f, ci) => { const prog = ss(T, 0.8 + f.delay, 3.8 + f.delay), lut = fLUT[ci]; for (let j = 0; j < FPC; j++) { const k = ci * FPC + j, u0 = j / FPC; const u = (u0 + T * 0.012) % 1; const p = lut[Math.min(599, Math.floor(u * 600))]; fp[k * 3] = p.x; fp[k * 3 + 1] = p.y; fp[k * 3 + 2] = p.z; const on = u0 < prog ? fBr : 0; fc[k * 3] = YEL.r * on; fc[k * 3 + 1] = YEL.g * on; fc[k * 3 + 2] = YEL.b * on; } });
    fieldPts.geometry.attributes.position.needsUpdate = true; fieldPts.geometry.attributes.aCol.needsUpdate = true;

    // Demo gradients
    const wx = win(T, 6.2, 8.3, 0.35), wy = win(T, 8.6, 10.6, 0.35), wz = win(T, 10.9, 12.9, 0.35);
    const demo = T < 15;

    // Device
    const u = uAt(T);
    const dev = mainC.getPointAt(u), vel = mainC.getPointAt(Math.min(1, uAt(T + 0.06))).sub(mainC.getPointAt(Math.max(0, uAt(T - 0.06))));
    const spd = vel.length() / 0.12;
    const dir = spd > 1e-5 ? vel.clone().normalize() : V(0, 0, -1);
    const sv = ss(T, 17, 17.6) * (1 - ss(T, 38, 39));
    const fw = Math.min(1, spd * 6) * sv;
    fwS += (fw - fwS) * 0.08;

    let gTarget, sphereP, sphereS, forceDir, forceW;
    if (demo) {
      gTarget = V(wx, wy, wz);
      const dv = win(T, 5.8, 13.3, 0.4);
      sphereP = ISO.clone().addScaledVector(gTarget, 0.09); sphereS = 0.032 * dv;
      forceDir = gTarget.lengthSq() > 1e-6 ? gTarget.clone().normalize() : V(1, 0, 0); forceW = gTarget.length() * dv;
    } else {
      gTarget = V(dir.x, 0, dir.z).multiplyScalar(fw);
      sphereP = dev; sphereS = 0.024 * sv; forceDir = dir; forceW = fw;
    }
    gS.lerp(gTarget, 0.12);
    sphere.position.copy(sphereP); sphere.scale.setScalar(Math.max(sphereS, 0.0001)); sphere.visible = sphereS > 0.0005;
    fArrow.setDirection(forceDir); fArrow.position.copy(sphereP); fArrow.setLength(0.07 + 0.16 * forceW, 0.045, 0.028); fArrow.visible = forceW > 0.08;
    tether.geometry.setDrawRange(0, Math.max(1, Math.floor(u * 420))); tether.material.uniforms.uOpacity.value = 0.9 * sv;

    // Sheet
    const sheetTarget = demo ? win(T, 6.0, 13.2, 0.4) : 0.85 * Math.min(1, fwS * 1.6);
    sheetOp += (sheetTarget - sheetOp) * 0.1;
    sheetTheta += ((demo ? Math.PI / 2 * win(T, 8.45, 10.75, 0.45) : 0) - sheetTheta) * 0.12;
    sheet.visible = sheetOp > 0.005;
    if (sheet.visible) {
      const sc = demo ? 1 : 0.42, C = demo ? ISO : dev;
      const A = V(Math.cos(sheetTheta), Math.sin(sheetTheta), 0), Nm = V(-Math.sin(sheetTheta), Math.cos(sheetTheta), 0);
      const ga = gS.dot(A), gz = gS.z, H = 0.15 * sc;
      const sp = sheet.geometry.attributes.position.array, scol = sheet.geometry.attributes.aCol.array, ssz = sheet.geometry.attributes.aSize.array;
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NA; i++) {
        const k = j * NA + i, an = (i / (NA - 1)) * 2 - 1, zn = (j / (NZ - 1)) * 2 - 1;
        const la = an * 0.5 * sc, lz = zn * 1.2 * sc, hn = ga * an + gz * zn, h = H * hn;
        sp[k * 3] = C.x + la * A.x + h * Nm.x; sp[k * 3 + 1] = C.y + la * A.y + h * Nm.y; sp[k * 3 + 2] = C.z + lz;
        const q = Math.min(1, Math.max(0, 0.5 + 0.5 * hn)), base = 0.32;
        scol[k * 3] = base + (YEL.r - base) * q; scol[k * 3 + 1] = base + (YEL.g - base) * q; scol[k * 3 + 2] = base + (YEL.b * 0.6 - base) * q;
        ssz[k] = (0.008 + 0.012 * q) * (demo ? 1 : 0.8);
      }
      sheet.geometry.attributes.position.needsUpdate = true; sheet.geometry.attributes.aCol.needsUpdate = true; sheet.geometry.attributes.aSize.needsUpdate = true;
      sheet.material.uniforms.uOpacity.value = sheetOp * fOut;
    }

    // Coil drive
    const tgt = [0, 0, 0];
    if (demo) { tgt[0] = wx; tgt[1] = wy; tgt[2] = wz; csign[0] = csign[1] = csign[2] = 1; }
    const imaging = (T > 13.4 && T < 16.6) || (T > 22.4 && T < 38);
    if (imaging) { const ii = Math.floor(T * 7) % 3; tgt[ii] = Math.max(tgt[ii], T < 16.6 ? 0.75 : 0.2); }
    if (!demo && fw > 0.08) [dir.x, dir.y, dir.z].forEach((c, i) => { const a = Math.min(1, Math.abs(c) * fw * 1.3); if (a > tgt[i]) { tgt[i] = a; csign[i] = c >= 0 ? 1 : -1; } });
    coils.forEach((c, i) => {
      cw[i] += (tgt[i] - cw[i]) * 0.14;
      cphase[i] += csign[i] * (0.4 + 5 * cw[i]) * dt * SPEED;
      const col = c.geometry.attributes.aCol.array, sz = c.geometry.attributes.aSize.array, dd = c.userData.d, w = cw[i];
      for (let k = 0; k < dd.length; k++) {
        const wave = 0.5 + 0.5 * Math.sin(dd[k] * 34 - cphase[i] * 12), amt = w * (0.35 + 0.65 * wave * wave * wave), g0 = 0.24 * (1 - amt);
        col[k * 3] = g0 + YEL.r * amt; col[k * 3 + 1] = g0 + YEL.g * amt; col[k * 3 + 2] = g0 + YEL.b * amt;
        sz[k] = 0.011 + 0.008 * amt;
      }
      c.geometry.attributes.aCol.needsUpdate = true; c.geometry.attributes.aSize.needsUpdate = true;
      c.material.uniforms.uOpacity.value = intro * fOut * 0.5 + 0.5 * intro;
    });

    body.material.uniforms.uOpacity.value = ss(T, 12.8, 14.5) * fOut;
    vessels.material.uniforms.uOpacity.value = ss(T, 13.2, 15) * fOut;

    // Slice
    let sz, sfill, sop;
    if (T < 17) { sz = TARGET.z; sfill = ss(T, 13.5, 16.3); sop = win(T, 13.4, 16.9, 0.35); }
    else { sz = dev.z; sfill = 1; sop = win(T, 22.6, 38.3, 0.5); }
    slice.position.z = sz; slice.visible = sop > 0.001;
    if (slice.visible) {
      const f2 = 1 - ((sz - BC.z) / BR.z) ** 2, f = f2 > 0 ? Math.sqrt(f2) : 0, rx = BR.x * f, ry = BR.y * f;
      const vc = []; vSamples.forEach((arr, ai) => { let best = null, bd = 1e9; for (const p of arr) { const dz = Math.abs(p.z - sz); if (dz < bd) { bd = dz; best = p; } } if (bd < 0.02) vc.push([best.x, best.y, ai ? vesselR * 0.8 : vesselR]); });
      const devOn = sv > 0.01 && Math.abs(dev.z - sz) < 0.07, lesOn = Math.abs(TARGET.z - sz) < 0.06, rows = sfill * N;
      for (let j = 0; j < N; j++) {
        const rowOn = j < rows, edge = Math.abs(j - rows) < 1.2 && sfill < 1;
        for (let i = 0; i < N; i++) {
          const k = j * N + i, x = sPos[k * 3], y = sPos[k * 3 + 1];
          let r = 0, g = 0, b = 0;
          if (rowOn && f > 0) {
            const e = ((x - BC.x) / rx) ** 2 + ((y - BC.y) / ry) ** 2;
            if (e <= 1) {
              let v = 0.12 + 0.1 * noise[k]; if (e > 0.72) v = 0.32 + 0.08 * noise[k];
              for (const [cx, cy, cr] of vc) if ((x - cx) ** 2 + (y - cy) ** 2 < cr * cr) v = 0.85;
              if (lesOn && (x - TARGET.x) ** 2 + (y - TARGET.y) ** 2 < 0.045 ** 2) v = 0.6 + 0.1 * noise[k];
              r = g = b = v;
              if (devOn) { const q = Math.sqrt((x - dev.x) ** 2 + (y - dev.y) ** 2); if (q < 0.02) r = g = b = 0; else if (q < 0.05) { r = 0.97; g = 0.8; b = 0.02; } }
            }
          }
          if (edge) { r = Math.max(r, 0.97); g = Math.max(g, 0.8); b = Math.max(b, 0.02); }
          sCol[k * 3] = r; sCol[k * 3 + 1] = g; sCol[k * 3 + 2] = b;
        }
      }
      slice.geometry.attributes.aCol.needsUpdate = true;
      slice.material.uniforms.uOpacity.value = sop;
    }

    const arrived = ss(T, 34.8, 35.4);
    const lc = lesion.geometry.attributes.aCol.array; for (let k = 0; k < lc.length; k += 3) { lc[k] = 1 + (YEL.r - 1) * arrived; lc[k + 1] = 1 + (YEL.g - 1) * arrived; lc[k + 2] = 1 + (YEL.b - 1) * arrived; }
    lesion.geometry.attributes.aCol.needsUpdate = true;
    lesion.material.uniforms.uOpacity.value = 0.8 * ss(T, 13.5, 14.5) * fOut; lesion.rotation.y = T * 0.4;
    rings.forEach((rg, i) => { const ph = T - 35.1 - i * 0.7, on = ph > 0 && ph < 2 && T < 38.6; rg.visible = on; if (on) { const q = ph / 2; rg.scale.setScalar(0.04 + 0.22 * q); rg.material.uniforms.uOpacity.value = 0.95 * (1 - q); rg.lookAt(camera.position); } });
  };

  // ── Playback: loop, pause when off-screen or hidden ─────────────────────────
  let raf = 0, last = null, inView = true;
  const frame = (now) => {
    if (last == null) last = now;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (reduce || raf || !inView || document.hidden) return; last = null; raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  if (window.ResizeObserver) new ResizeObserver(resize).observe(mount); else window.addEventListener('resize', resize);
  resize();

  if (reduce) {
    // Still frame: settle the smoothed state over the few seconds before STILL_T.
    clock = STILL_T - 4;
    for (let i = 0; i < 240; i++) update(1 / 60);
    renderer.render(scene, camera);
    return;
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; if (inView) start(); else stop(); }).observe(mount);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  start();
}
