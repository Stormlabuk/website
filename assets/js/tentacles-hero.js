/* Magnetic tentacles — research hero animation (ES module, WebGL).
   Port of the Claude Design "Magnetic Tentacles Hero v4": a soft magnetic
   tentacle, drawn in halftone dots with yellow magnetisation ticks, is steered
   by an external field grid to a target in three anatomies — Lungs (peripheral
   nodule), Pancreas (duodenal access) and Skull (deep target via cerebral
   vasculature) — cycling every 16 s, with slow auto-rotation and pointer
   parallax. Uses the self-hosted Three.js in /assets/vendor/three. Pauses
   off-screen / in background tabs; still frame under prefers-reduced-motion;
   degrades to the plain dark hero if WebGL is unavailable. */
import * as T from '../vendor/three/three.module.min.js';

const host = document.getElementById('tentacles-hero');
const fade = document.getElementById('tentacles-hero-fade');
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (host) { try { init(); } catch (e) { console.warn('Tentacles hero unavailable:', e); if (fade) fade.style.opacity = '0'; } }

function init() {
  // Design settings: all scenes, field on, auto-rotate on, 16 s per scene.
  const CYC = 16, SHOW_FIELD = true, AUTO_ROTATE = true;
  const STILL_EL = 0.72 * CYC; // reduced motion: Lungs, tentacle navigating with the field on

  const V = T.Vector3, YEL = 0xF8CD04, PI = Math.PI;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 1, 5000);
  let seed = 21;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ease = x => x * x * (3 - 2 * x), cl = x => Math.min(1, Math.max(0, x)), seg = (u, a, b) => cl((u - a) / (b - a));
  const v = (x, y, z) => new V(x, y, z || 0);

  const dotU = { uSize: { value: 0.8 }, uScale: { value: 1000 } };
  const dotF = 'varying float vB; void main(){ vec2 c = gl_PointCoord-0.5; if(dot(c,c) > 0.25) discard; gl_FragColor = vec4(vec3(vB),1.0); }';
  const dotMat = new T.ShaderMaterial({
    uniforms: dotU, fragmentShader: dotF,
    vertexShader: 'attribute float aB; uniform float uSize; uniform float uScale; varying float vB; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normal); vec3 v = normalize(-mv.xyz); float l = max(dot(n, normalize(vec3(0.35,0.8,0.5))),0.0); float f = dot(n,v); vB = aB*(0.28+0.72*l)*(f < 0.0 ? 0.3 : 1.0); gl_PointSize = uSize*(0.45+0.55*l)*(f < 0.0 ? 0.65 : 1.0)*uScale/(-mv.z); gl_Position = projectionMatrix*mv; }'
  });
  const mkDots = (cap, parent) => {
    const pos = new Float32Array(cap * 3), nor = new Float32Array(cap * 3), b = new Float32Array(cap);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('aB', new T.BufferAttribute(b, 1));
    const p = new T.Points(g, dotMat); p.frustumCulled = false; parent.add(p);
    const D = { n: 0, box: new T.Box3(),
      begin() { D.n = 0; },
      push(x, y, z, nx, ny, nz, br) { if (D.n >= cap) return; const i = D.n++; pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z; nor[3 * i] = nx; nor[3 * i + 1] = ny; nor[3 * i + 2] = nz; b[i] = br; },
      end(fit) { g.setDrawRange(0, D.n); ['position', 'normal', 'aB'].forEach(k => g.attributes[k].needsUpdate = true); if (fit) { g.computeBoundingBox(); D.box.copy(g.boundingBox); } }
    };
    return D;
  };
  const curveOf = pts => { const c = new T.CatmullRomCurve3(pts, false, 'centripetal'); c.L = c.getLength(); return c; };
  const tube = (D, c, rf, br, spf) => {
    let k = 0; const n = new V(), b = new V();
    for (let s = 0; s <= c.L; k++) {
      const u = s / c.L, p = c.getPointAt(u), t = c.getTangentAt(u);
      n.crossVectors(t, Math.abs(t.z) > 0.9 ? v(1, 0, 0) : v(0, 0, 1)).normalize(); b.crossVectors(t, n);
      const R = rf(u, s), sp = spf(R), M = Math.max(6, Math.round(2 * PI * R / sp)), off = (k % 2) * 0.5;
      for (let j = 0; j < M; j++) { const g = (j + off) / M * 2 * PI, cg = Math.cos(g), sg = Math.sin(g); const nx = n.x * cg + b.x * sg, ny = n.y * cg + b.y * sg, nz = n.z * cg + b.z * sg; D.push(p.x + nx * R, p.y + ny * R, p.z + nz * R, nx, ny, nz, br); }
      s += sp;
    }
  };
  const spDef = R => Math.max(0.85, Math.min(1.7, R * 0.36));
  const organic = (r, flare) => (u, s) => r * (1.04 - 0.14 * u) * (1 + (flare ? 0.2 * Math.exp(-s / (0.9 * r)) : 0)) * (1 + 0.03 * Math.sin(s * 0.9 + r * 7));
  const growT = (p0, dir, len, r, d, maxD, parent, out, phi, grav) => {
    const ref = Math.abs(dir.y) < 0.95 ? v(0, 1, 0) : v(1, 0, 0);
    const side = new V().crossVectors(dir, ref).normalize();
    const end = p0.clone().addScaledVector(dir, len);
    const mid = p0.clone().lerp(end, 0.5).addScaledVector(side, (rnd() - 0.5) * len * 0.16);
    const node = { c: curveOf([p0, mid, end]), r, d, parent }; out.push(node);
    if (d < maxD) {
      const t = node.c.getTangentAt(1), r2 = Math.abs(t.y) < 0.95 ? v(0, 1, 0) : v(1, 0, 0);
      const p = new V().crossVectors(t, r2).normalize().applyAxisAngle(t, phi);
      const a1 = d === 0 ? 0.8 : 0.38 + rnd() * 0.32, a2 = d === 0 ? 0.7 : 0.34 + rnd() * 0.36;
      const d1 = t.clone().multiplyScalar(Math.cos(a1)).addScaledVector(p, Math.sin(a1)); d1.y += grav; d1.normalize();
      const d2 = t.clone().multiplyScalar(Math.cos(a2)).addScaledVector(p, -Math.sin(a2)); d2.y += grav; d2.normalize();
      const lf = 0.8 + rnd() * 0.08;
      growT(end, d1, len * lf * (0.9 + rnd() * 0.2), r * 0.74, d + 1, maxD, node, out, phi + PI / 2 + (rnd() - 0.5) * 0.7, grav);
      growT(end, d2, len * lf * (0.9 + rnd() * 0.2), r * 0.7, d + 1, maxD, node, out, phi + PI / 2 + (rnd() - 0.5) * 0.7, grav);
    }
  };
  const drawTree = (D, nodes, br0) => nodes.forEach(nd => tube(D, nd.c, organic(nd.r, nd.d > 0), br0 - nd.d * 0.06, spDef));

  const SC = [];
  // Lungs: peripheral nodule
  {
    const g = new T.Group(); scene.add(g); const D = mkDots(90000, g);
    const nodes = []; growT(v(0, 60), v(0, -1), 36, 7, 0, 5, null, nodes, PI / 2, -0.2);
    D.begin(); drawTree(D, nodes, 0.6); D.end(true);
    let best = null, bs = -1e9;
    nodes.filter(n => n.d === 5).forEach(n => { const e = n.c.getPointAt(1); const sc = -Math.abs(e.z) * 0.8 - Math.abs(e.x - 30) * 0.3 - e.y * 0.15; if (sc > bs) { bs = sc; best = n; } });
    const chain = []; for (let n = best; n; n = n.parent) chain.unshift(n);
    const L = 60, pts = [v(0, 60 + L), v(0, 60 + L / 2), v(0, 60)];
    chain.forEach(nd => { for (let i = 1; i <= 8; i++) pts.push(nd.c.getPointAt(i / 8)); });
    const tgt = best.c.getPointAt(1).clone().addScaledVector(best.c.getTangentAt(1), 3.5);
    SC.push({ g, box: D.box, route: curveOf(pts), L, R: 0.85, entry: v(0, 60), out: v(0, 1), alpha: -1.25, prof: s => s / L * PI * 3, tgt, tR: 3 });
  }
  // Pancreas: duodenal access to a lesion in the pancreatic body
  {
    const g = new T.Group(); scene.add(g); const D = mkDots(60000, g);
    D.begin();
    const duo = curveOf([v(20, 62), v(20, 44), v(27, 30, 4), v(30, 14, 6), v(26, -4, 5), v(16, -14, 2), v(2, -14, -2), v(-10, -6, -4)]);
    tube(D, duo, (u, s) => 6.2 * (1 + 0.06 * Math.sin(s * 0.55)), 0.5, R => 1.5);
    const pan = curveOf([v(21, 2, 2), v(15, 14, 1), v(0, 20), v(-20, 24, -2), v(-42, 30, -1), v(-62, 38, 2)]);
    tube(D, pan, (u, s) => (13 - 7.5 * u) * (1 + 0.08 * Math.sin(s * 0.35) + 0.05 * Math.sin(s * 1.1)), 0.42, R => 1.7);
    const duct = curveOf([v(28.5, 15, 5), v(20, 18, 2), v(8, 20), v(-10, 22, -2), v(-30, 26, -2), v(-48, 32), v(-60, 38, 2)]);
    tube(D, duct, u => 1.9 - 0.6 * u, 0.55, R => 0.8);
    D.end(true);
    const L = 60;
    const route = curveOf([v(20, 62 + L), v(20, 62 + L / 2), v(20, 62), v(20, 44), v(27, 30, 4), v(29.5, 20, 5.5), v(28, 15, 5), v(20, 18, 2), v(8, 20), v(-10, 22, -2), v(-27, 25.5, -2)]);
    SC.push({ g, box: D.box, route, L, R: 1.05, entry: v(20, 62), out: v(0, 1), alpha: -1.2, prof: s => -s / L * PI * 2, tgt: v(-31, 26.5, -2), tR: 4.5 });
  }
  // Skull: deep target via tortuous cerebral vasculature
  {
    const g = new T.Group(); scene.add(g); const D = mkDots(60000, g);
    D.begin();
    const NS = 7000, ga = PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NS; i++) {
      const y = 1 - 2 * (i + 0.5) / NS, r = Math.sqrt(1 - y * y), th = i * ga;
      if (y < -0.5) continue;
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      const bulge = 1 + 0.08 * Math.max(0, -x) * (y + 0.3);
      const px = x * 70 * bulge, py = y * 52 + 6, pz = z * 58;
      const n = v(x / 70, y / 52, z / 58).normalize();
      D.push(px, py, pz, n.x, n.y, n.z, 0.3);
    }
    const L = 55;
    const vp = [v(8, -60), v(8, -48), v(12, -38, 6), v(6, -30, 12), v(-3, -32, 6), v(-2, -22, -2), v(6, -14), v(14, -8, -2), v(22, 0, -6), v(26, 8, -4)];
    const vessel = curveOf([...vp, v(32, 18), v(34, 30, 4)]);
    tube(D, vessel, (u, s) => (2.8 - 1.2 * u) * (1 + 0.03 * Math.sin(s)), 0.6, spDef);
    const br = [];
    [[0.42, 1], [0.55, -1], [0.66, 1], [0.8, -1], [0.9, 1]].forEach(([u, sg]) => {
      const p = vessel.getPointAt(u), t = vessel.getTangentAt(u);
      const ax = new V().crossVectors(t, v(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)).normalize();
      growT(p, t.clone().applyAxisAngle(ax, sg * (0.7 + rnd() * 0.4)), 11 + rnd() * 5, 1.7, 1, 3, null, br, rnd() * PI, 0.1);
    });
    drawTree(D, br, 0.62);
    D.end(true);
    const route = curveOf([v(8, -60 - L), v(8, -60 - L / 2), ...vp]);
    SC.push({ g, box: D.box, route, L, R: 0.8, entry: v(8, -60), out: v(0, -1), alpha: 1.2, prof: s => s / L * PI * 5, tgt: v(28, 12, -3), tR: 3 });
  }
  SC.forEach(S => {
    const far = S.entry.clone().addScaledVector(S.out.clone().applyAxisAngle(v(0, 0, 1), S.alpha), S.L);
    const b = S.box.clone().expandByPoint(far).expandByPoint(S.entry.clone().addScaledVector(S.out, S.L * 0.3));
    S.c = b.getCenter(new V()); const sz = b.getSize(new V()); S.w = sz.x * 1.22; S.h = sz.y * 1.15;
  });

  // Tentacle
  const tg = new T.Group(); scene.add(tg);
  const TD = mkDots(6000, tg);
  const tickPos = new Float32Array(400 * 6);
  const tkg = new T.BufferGeometry(); tkg.setAttribute('position', new T.BufferAttribute(tickPos, 3));
  const tickMat = new T.LineBasicMaterial({ color: YEL, transparent: true, depthTest: false });
  const ticks = new T.LineSegments(tkg, tickMat); ticks.frustumCulled = false; ticks.renderOrder = 10; tg.add(ticks);
  const headMat = new T.MeshBasicMaterial({ color: YEL, transparent: true, depthWrite: false, side: T.DoubleSide });
  const head = new T.Mesh(new T.TorusGeometry(1, 0.08, 8, 64), headMat); tg.add(head);

  const tgtMat = new T.MeshBasicMaterial({ color: YEL, wireframe: true, transparent: true });
  const tgtM = new T.Mesh(new T.IcosahedronGeometry(1, 1), tgtMat); scene.add(tgtM);
  const ringMat = new T.MeshBasicMaterial({ color: YEL, transparent: true, side: T.DoubleSide, depthWrite: false });
  const ringM = new T.Mesh(new T.RingGeometry(1.5, 1.6, 64), ringMat); scene.add(ringM);

  // Field grid
  const FG = []; for (let x = -1; x <= 1.001; x += 0.1) for (let y = -1; y <= 1.001; y += 0.1) FG.push([x, y]);
  const fPos = new Float32Array(FG.length * 6), fTip = new Float32Array(FG.length * 3);
  const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fPos, 3));
  const fdg = new T.BufferGeometry(); fdg.setAttribute('position', new T.BufferAttribute(fTip, 3));
  const fMat = new T.LineBasicMaterial({ color: YEL, transparent: true, opacity: 0, depthWrite: false });
  const fdMat = new T.PointsMaterial({ color: YEL, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const fl = new T.LineSegments(fg, fMat), fd = new T.Points(fdg, fdMat); fl.frustumCulled = fd.frustumCulled = false; scene.add(fl, fd);
  const setField = (S, phi) => {
    const W2 = S.h * 1.6, H2 = S.h * 0.9, z = S.box.min.z - 30, k = S.h * 0.012, cx = Math.cos(phi) * k, cy = Math.sin(phi) * k;
    FG.forEach(([x, y], i) => { const px = S.c.x + x * W2, py = S.c.y + y * H2; fPos.set([px - cx, py - cy, z, px + cx, py + cy, z], i * 6); fTip.set([px + cx, py + cy, z], i * 3); });
    fg.attributes.position.needsUpdate = true; fdg.attributes.position.needsUpdate = true;
  };

  // Background star-field of dots
  const bp = [], bb = [];
  for (let i = 0; i < 2800; i++) {
    const r = 380 + rnd() * 420, a = rnd() * 2 * PI, ph = Math.acos(2 * rnd() - 1);
    bp.push(Math.sin(ph) * Math.cos(a) * r, Math.cos(ph) * r * 0.7, Math.sin(ph) * Math.sin(a) * r);
    bb.push(0.16 + rnd() * 0.24);
  }
  const bgg = new T.BufferGeometry();
  bgg.setAttribute('position', new T.Float32BufferAttribute(bp, 3));
  bgg.setAttribute('aB', new T.Float32BufferAttribute(bb, 1));
  const bgMat = new T.ShaderMaterial({
    uniforms: { uScale: dotU.uScale, uTime: { value: 0 } }, fragmentShader: dotF,
    vertexShader: 'attribute float aB; uniform float uScale; uniform float uTime; varying float vB; void main(){ vec3 p = position; p.y += sin(uTime*0.15 + position.x*0.02)*4.0; vec4 mv = modelViewMatrix*vec4(p,1.0); vB = aB; gl_PointSize = clamp(1.8*uScale/(-mv.z), 1.5, 3.2); gl_Position = projectionMatrix*mv; }'
  });
  scene.add(new T.Points(bgg, bgMat));

  // Pointer parallax
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduce) window.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2; }, { passive: true });

  let W = 1, H = 1;
  const resize = () => {
    W = host.clientWidth || 1; H = host.clientHeight || 1;
    renderer.setSize(W, H, false); camera.aspect = W / H;
    if (W / H > 1.1) camera.setViewOffset(W, H, -W * 0.28, 0, W, H);
    else camera.setViewOffset(W, H, 0, H * 0.2, W, H); // portrait (phones): lift the scene above the full-width title
    camera.updateProjectionMatrix();
    dotU.uScale.value = H * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * PI / 360));
    if (!raf) renderer.render(scene, camera); // keep a paused / still frame correct after resizing
  };

  const look = new V(), zAx = v(0, 0, 1), pP = new V(), pT = new V(), n = new V(), b = new V(), tmp = new V();
  let yawAcc = 0, lastCyc = -1, S = SC[0], hCur = 100, wCur = 100, first = true;
  const pts = [];

  // One frame of the design's loop at scene time `el` (s) with step `dt` (s).
  const step = (el, dt) => {
    const cyc = Math.floor(el / CYC), u = (el % CYC) / CYC;
    if (cyc !== lastCyc) {
      lastCyc = cyc;
      S = SC[cyc % SC.length];
      SC.forEach(s => s.g.visible = s === S);
      look.copy(S.c); hCur = S.h; wCur = S.w; first = true;
    }
    if (fade) fade.style.opacity = String(Math.max(0, 1 - u / 0.04, (u - 0.95) / 0.05));

    const fp = seg(u, 0.04, 0.26);
    const al = S.alpha * (1 - ease(seg(u, 0.27, 0.35)));
    const nav = ease(seg(u, 0.36, 0.82));
    const sHead = S.L + (S.route.L - S.L - 0.5) * nav;
    const outR = S.out.clone().applyAxisAngle(zAx, al);
    const R = S.R, NB = Math.round(S.L / 0.62);
    const inserting = u >= 0.36, Lo = inserting ? Math.max(0, 2 * S.L - sHead) : S.L;
    const d1 = new V().crossVectors(outR, zAx).normalize(); if (d1.y > 0) d1.negate();
    const sagA = S.L * 0.16, wA = S.L * 0.045;
    for (let i = 0; i <= NB; i++) {
      const sb = i / NB * S.L, p = pts[i] || (pts[i] = new V());
      if (sb <= Lo && Lo > 0.01) {
        const f = sb / Lo, env = Math.sin(PI * f) * (Lo / S.L);
        p.copy(S.entry).addScaledVector(outR, Lo - sb)
          .addScaledVector(d1, sagA * env + wA * env * Math.sin(2 * PI * 1.3 * f - el * 2.2))
          .addScaledVector(zAx, wA * 0.8 * env * Math.cos(2 * PI * f - el * 1.6));
      } else {
        const qs = sHead - S.L + sb; p.copy(S.route.getPointAt(cl(qs / S.route.L)));
      }
    }
    TD.begin(); let nT = 0; const tipP = new V(), tipT = new V();
    for (let i = 0; i <= NB; i++) {
      const sb = i / NB * S.L;
      pP.copy(pts[i]); pT.subVectors(pts[Math.min(NB, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      if (i === 0) { n.crossVectors(pT, Math.abs(pT.z) > 0.9 ? v(1, 0, 0) : zAx).normalize(); }
      else { n.addScaledVector(pT, -n.dot(pT)).normalize(); }
      b.crossVectors(pT, n);
      if (i === NB) { tipP.copy(pP); tipT.copy(pT); }
      if (sb > fp * S.L + 0.01) continue;
      const Ri = R * (1 + 0.12 * Math.sin(sb * 0.9 - el * 3.2));
      const M = Math.max(8, Math.round(2 * PI * R / 0.5)), off = (i % 2) * 0.5;
      for (let j = 0; j < M; j++) { const g = (j + off) / M * 2 * PI, cg = Math.cos(g), sg = Math.sin(g); const nx = n.x * cg + b.x * sg, ny = n.y * cg + b.y * sg, nz = n.z * cg + b.z * sg; TD.push(pP.x + nx * Ri, pP.y + ny * Ri, pP.z + nz * Ri, nx, ny, nz, 1); }
      if (i % 4 === 2 && sb < (fp - 0.1) * S.L && nT < 400) {
        const ph = S.prof(sb), dx = n.x * Math.cos(ph) + b.x * Math.sin(ph), dy = n.y * Math.cos(ph) + b.y * Math.sin(ph), dz = n.z * Math.cos(ph) + b.z * Math.sin(ph), k = Ri * 1.45;
        tickPos.set([pP.x - dx * k, pP.y - dy * k, pP.z - dz * k, pP.x + dx * k, pP.y + dy * k, pP.z + dz * k], nT * 6); nT++;
      }
      if (Math.abs(sb - fp * S.L) < 0.4 && fp < 1) { head.position.copy(pP); head.quaternion.setFromUnitVectors(zAx, pT); head.scale.setScalar(R * 1.9); }
    }
    if (fp >= 0.999) for (let e = 1; e <= 3; e++) {
      const f = e / 3.5, rr = R * Math.sqrt(1 - f * f); tmp.copy(tipP).addScaledVector(tipT, f * R);
      const M = Math.max(4, Math.round(2 * PI * rr / 0.5));
      for (let j = 0; j < M; j++) { const g = j / M * 2 * PI, cg = Math.cos(g), sg = Math.sin(g); const nx = n.x * cg + b.x * sg, ny = n.y * cg + b.y * sg, nz = n.z * cg + b.z * sg; TD.push(tmp.x + nx * rr, tmp.y + ny * rr, tmp.z + nz * rr, nx * 0.6 + tipT.x * 0.4, ny * 0.6 + tipT.y * 0.4, nz * 0.6 + tipT.z * 0.4, 1); }
    }
    TD.end();
    tkg.setDrawRange(0, nT * 2); tkg.attributes.position.needsUpdate = true;
    tickMat.opacity = 0.95;
    head.visible = fp > 0 && fp < 1; headMat.opacity = 0.9 * Math.sin(Math.min(1, fp * 1.02) * PI) ** 0.3;

    const reach = u > 0.8 && u < 0.97;
    tgtM.position.copy(S.tgt); tgtM.scale.setScalar(S.tR * (1 + 0.08 * Math.sin(el * 3)));
    tgtM.rotation.y += dt * 0.6; tgtM.rotation.x += dt * 0.35; tgtMat.opacity = 0.8;
    const pulse = reach ? (el * 0.9) % 1 : 0;
    ringM.position.copy(S.tgt); ringM.quaternion.copy(camera.quaternion); ringM.scale.setScalar(S.tR * (1 + pulse * 1.8)); ringMat.opacity = reach ? 0.8 * (1 - pulse) : 0;

    const fOn = SHOW_FIELD ? ease(seg(u, 0.3, 0.38)) * (1 - seg(u, 0.86, 0.94)) : 0;
    setField(S, Math.atan2(tipT.y, tipT.x)); fMat.opacity = 0.2 * fOn; fdMat.opacity = 0.35 * fOn;

    const kf = first ? 1 : 1 - Math.exp(-dt * 1.2); first = false;
    const lt = S.c.clone().lerp(tipP, 0.15 * ease(seg(u, 0.36, 0.6)));
    look.lerp(lt, kf);
    const zf = 1 - 0.1 * ease(seg(u, 0.4, 0.8)); hCur += (S.h * zf - hCur) * kf; wCur += (S.w * zf - wCur) * kf;
    mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3)); mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));
    if (AUTO_ROTATE) yawAcc += dt * 0.09;
    const yaw = 0.38 * Math.sin(yawAcc) + mouse.x * 0.2, pitch = 0.16 + 0.08 * Math.sin(yawAcc * 0.7) + mouse.y * 0.08;
    const tf = Math.tan(camera.fov * PI / 360), asp = W / H;
    const dist = Math.max(hCur / (2 * tf), wCur / (2 * tf * (asp > 1.1 ? asp * 0.46 : asp)));
    camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(look); camera.updateMatrixWorld();
    bgMat.uniforms.uTime.value = el;
  };

  // ── Playback: loop, pause when off-screen or hidden ─────────────────────────
  let raf = 0, last = null, el = 0, inView = true;
  const frame = (now) => {
    if (last == null) last = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    el += dt;
    step(el, dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (reduce || raf || !inView || document.hidden) return; last = null; raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  resize();

  if (reduce) {
    // Still frame: settle the eased camera over the seconds leading up to STILL_EL.
    for (let t = 0; t <= STILL_EL; t += 1 / 30) step(t, 1 / 30);
    renderer.render(scene, camera);
    return;
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; if (inView) start(); else stop(); }).observe(host);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  start();
}
