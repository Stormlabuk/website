/* Magnetic flexible endoscopy — research hero animation (ES module, WebGL).
   Port of the Claude Design "MFE Hero v4": a KUKA LBR arm carries the external
   permanent magnet over an anatomical colon (rectum → caecum) while the
   capsule-tipped endoscope glides beneath it, all drawn in halftone dots. The
   scene assembles from a scatter, a yellow wave sweeps along the colon, the
   camera swings in to the capsule with the colon wall cut away, pulls back out,
   and it disperses again on a 30 s loop. The arm's dot cloud is pre-sampled from the robot's STL meshes
   (assets/data/kuka-lbr-points.bin). Uses the self-hosted Three.js in
   /assets/vendor/three. Pauses off-screen / in background tabs; still frame
   under prefers-reduced-motion; degrades to the plain dark hero if WebGL is
   unavailable. */
import * as T3 from '../vendor/three/three.module.min.js';

const host = document.getElementById('mfe-hero');
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const KUKA_URL = new URL('../data/kuka-lbr-points.bin', import.meta.url);
if (host) { try { init(); } catch (e) { console.warn('MFE hero unavailable:', e); } }

function init() {
  // Design settings: Right layout, speed 1, transitions on, field lines off, dot scale 1.
  const SPEED = 1, TRANSITIONS = true, FIELD_LINES = false, DOT_SCALE = 1;
  const START_T = 0.4, STILL_T = 4.2; // reduced motion: wide shot, scene assembled, before the wave and zoom

  const V = (x, y, z) => new T3.Vector3(x, y, z), DEG = Math.PI / 180;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const LOOP = 30;
  const ssm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const renderer = new T3.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr); renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  host.appendChild(renderer.domElement);
  const scene = new T3.Scene();
  const camera = new T3.PerspectiveCamera(26, 16 / 9, 50, 20000);
  const U = { uPR: { value: pr }, uRef: { value: 2400 }, uScale: { value: 1 }, uLight: { value: V(-0.3, 0.8, 0.5).normalize() }, uMix: { value: 0 }, uWaveX: { value: -9999 }, uWaveOn: { value: 0 }, uTime: { value: 0 }, uH: { value: 800 }, uCut: { value: 0 }, uCapD: { value: 1e6 } };
  const VS = `attribute vec3 aN; attribute vec3 aC; attribute float aA; attribute vec3 aR;
uniform float uPx; uniform float uPR; uniform float uRef; uniform float uScale; uniform float uFade; uniform vec3 uLight; uniform float uMix; uniform float uWaveX; uniform float uWaveOn; uniform float uTime; uniform float uH; uniform float uCut; uniform float uCapD; uniform float uCutOn; uniform float uAway;
varying vec3 vC; varying float vA;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float st = clamp(uMix * 1.7 - (aR.y * 0.5 + 0.5) * 0.7, 0.0, 1.0); st = st * st * (3.0 - 2.0 * st);
  float ang = st * (0.6 + 0.9 * aR.x);
  vec3 off = vec3(aR.x * 240.0 + 260.0 * st, aR.y * 150.0 + 60.0 * sin(uTime * 0.9 + aR.z * 6.0), aR.z * 240.0);
  vec3 rel = wp.xyz - vec3(200.0, 120.0, -150.0);
  vec3 sw = vec3(rel.x * cos(ang) - rel.z * sin(ang), rel.y, rel.x * sin(ang) + rel.z * cos(ang)) + vec3(200.0, 120.0, -150.0);
  wp.xyz = mix(wp.xyz, sw + off, st);
  vec4 mv = viewMatrix * wp;
  vec3 n = normalize(mat3(modelMatrix) * aN);
  vec3 vd = normalize(cameraPosition - wp.xyz);
  float f = dot(n, vd);
  float lit = 0.35 + 0.45 * max(dot(n, uLight), 0.0) + 0.4 * abs(f);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  float nx = gl_Position.x / gl_Position.w;
  vA = aA * mix(1.0, smoothstep(-1.05, -0.35, nx), uFade) * (f < 0.0 ? 0.55 : 1.0) * (1.0 - 0.35 * st) * (1.0 - 0.7 * uCut * uAway) * mix(1.0, smoothstep(0.3 * uRef, 0.7 * uRef, d), uAway) * (1.0 - uCut * uCutOn * (1.0 - smoothstep(uCapD - 8.0, uCapD + 6.0, d)));
  float wv = uWaveOn * uCutOn * exp(-pow((wp.x - uWaveX) / 16.0, 2.0));
  vC = mix(aC * lit * mix(1.05, 0.38, smoothstep(uRef * 0.8, uRef * 1.45, d)), vec3(0.973, 0.804, 0.016) * 1.15, wv * 0.75);
  gl_PointSize = max(uPx * uPR * uScale * uH / d * (1.0 + 0.7 * wv) * (1.0 - 0.15 * st), 1.0);
}`;
  const FS = `varying vec3 vC; varying float vA;
void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p); if (r > 0.5) discard; float a = smoothstep(0.5, 0.36, r) * vA; if (a < 0.02) discard; gl_FragColor = vec4(vC, a); }`;
  let seed = 7; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const cloud = (list, px, parent, fade, away) => {
    const n = list.length, g = new T3.BufferGeometry(), P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), A = new Float32Array(n), RR = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) RR[i] = rnd() * 2 - 1;
    list.forEach((q, i) => { P.set(q[0], i * 3); N.set(q[1], i * 3); C.set(q[2], i * 3); A[i] = q[3] == null ? 1 : q[3]; });
    g.setAttribute('position', new T3.BufferAttribute(P, 3)); g.setAttribute('aN', new T3.BufferAttribute(N, 3)); g.setAttribute('aC', new T3.BufferAttribute(C, 3)); g.setAttribute('aA', new T3.BufferAttribute(A, 1)); g.setAttribute('aR', new T3.BufferAttribute(RR, 3));
    const m = new T3.Points(g, new T3.ShaderMaterial({ uniforms: { ...U, uPx: { value: px }, uFade: { value: fade ? 1 : 0 }, uCutOn: { value: fade ? 1 : 0 }, uAway: { value: away ? 1 : 0 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: true }));
    m.frustumCulled = false; (parent || scene).add(m); return { m, g, P, N, A, n };
  };
  const WH = [0.95, 0.95, 0.95], YL = [0.973, 0.804, 0.016];

  // ---- colon: anatomical frame lying horizontal (rectum → sigmoid → descending → transverse → ascending → caecum) ----
  const SC = 0.25, RING = 6, NA = 30, CR = 92 * SC;
  const CPTS = [[330, -60, 560], [330, -30, 430], [360, -10, 320], [470, 20, 250], [600, 30, 300], [700, 20, 240], [800, 0, 150], [880, 0, 30], [900, 0, -120], [905, 10, -280], [880, 40, -410], [800, 60, -480], [640, 40, -440], [470, 10, -300], [300, 0, -260], [130, 10, -310], [-40, 40, -420], [-170, 40, -440], [-270, 20, -380], [-310, 0, -250], [-320, 0, -80], [-315, -10, 80], [-300, -20, 210]];
  const colCurve = new T3.CatmullRomCurve3(CPTS.map(q => V(q[0] * SC, q[1] * SC, q[2] * SC)), false, 'centripetal'); colCurve.arcLengthDivisions = 3000;
  const LC = colCurve.getLength(), NRG = Math.round(LC / RING);
  const RF = [], CPs = [], CTs = [], N1s = [], N2s = [];
  for (let i = 0; i <= NRG; i++) { const u = i / NRG, t = colCurve.getTangentAt(u); CPs.push(colCurve.getPointAt(u)); CTs.push(t);
    const n1 = i === 0 ? V(0, 1, 0).addScaledVector(t, -t.y).normalize() : N1s[i - 1].clone().addScaledVector(t, -t.dot(N1s[i - 1])).normalize(); N1s.push(n1); N2s.push(t.clone().cross(n1)); }
  const RADK = [[0, 0.7], [0.08, 0.72], [0.14, 0.62], [0.3, 0.64], [0.4, 0.8], [0.5, 0.9], [0.62, 1.0], [0.75, 1.0], [0.88, 1.12], [0.96, 1.3], [1, 1.3]];
  const radK = (u) => { for (let i = 0; i < RADK.length - 1; i++) { const a = RADK[i], b = RADK[i + 1]; if (u <= b[0]) return lerp(a[1], b[1], ssm(a[0], b[0], u)); } return 1.3; };
  const pAt = (u) => colCurve.getPointAt(cl(u, 0, 1)), tAt = (u) => colCurve.getTangentAt(cl(u, 0, 1));
  const colon = (() => { const L = []; for (let i = 0; i <= NRG; i++) for (let j = 0; j < NA; j++) { const a = (j + (i & 1) * 0.5) / NA * Math.PI * 2; L.push([[0, 0, 0], [0, 1, 0], WH, 1]); } return cloud(L, 2.1, null, true); })();
  const updColon = (T, capU) => {
    const P = colon.P, N = colon.N;
    for (let i = 0; i <= NRG; i++) {
      const u = i / NRG, sArc = u * LC, haus = ssm(0.07, 0.12, u), hs = Math.pow(Math.abs(Math.sin(Math.PI * sArc / 17.5)), 0.55);
      const wave = 0.04 * Math.sin(sArc / 38 - 2 * Math.PI * T / 5), bulge = 0.08 * Math.exp(-(((u - capU) * LC / 28) ** 2));
      let r = CR * radK(u) * (lerp(1, 0.8 + 0.2 * hs, haus) + wave + bulge) * (0.55 + 0.45 * ssm(0, 0.04, u));
      const cap = ssm(0.975, 1, u); r *= Math.sqrt(Math.max(0.05, 1 - cap * cap));
      const c = CPs[i], n1 = N1s[i], n2 = N2s[i];
      for (let j = 0; j < NA; j++) { const k = (i * NA + j) * 3, a = (j + (i & 1) * 0.5) / NA * Math.PI * 2, co = Math.cos(a), si = Math.sin(a);
        const tae = 1 - 0.1 * haus * Math.pow(0.5 + 0.5 * Math.cos(3 * a), 10);
        const nx = n1.x * co + n2.x * si, ny = n1.y * co + n2.y * si, nz = n1.z * co + n2.z * si;
        P[k] = c.x + nx * r * tae; P[k + 1] = c.y + ny * r * tae; P[k + 2] = c.z + nz * r * tae; N[k] = nx; N[k + 1] = ny; N[k + 2] = nz; }
    }
    colon.g.attributes.position.needsUpdate = true; colon.g.attributes.aN.needsUpdate = true;
  };
  const U0 = 0.34, U1 = 0.5;

  // ---- MFE tip, modelled on the device photo (real mm, drawn at 4x to match the hero colon) ----
  const CS = 1, capG = new T3.Group(); capG.scale.setScalar(CS); scene.add(capG);
  {
    const L = [], SH = [0.96, 0.84, 0.78], R = 10, sp = 0.9;
    const FEAT = [[-2.6, 0, 3.4, 'led'], [3.6, 5.6, 1.5, 'cam'], [-1.2, 7.6, 1.0, 'ins'], [6.4, 2.2, 1.6, 'ther'], [6.8, -2.4, 1.0, 'irr']];
    for (let x = -15, k = 0; x <= 13.01; x += sp, k++) { const n = Math.round(2 * Math.PI * R / sp); for (let j = 0; j < n; j++) { const a = (j + (k & 1) * 0.5) / n * Math.PI * 2; L.push([[x, Math.cos(a) * R, Math.sin(a) * R], [0, Math.cos(a), Math.sin(a)], SH, 0.5]); } }
    for (let th = 0; th <= Math.PI / 2 + 0.01; th += 0.18) { const rr = R - 2 + 2 * Math.cos(th), x = 13 + 2 * Math.sin(th), n = Math.round(2 * Math.PI * rr / sp); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; L.push([[x, Math.cos(a) * rr, Math.sin(a) * rr], [Math.sin(th), Math.cos(th) * Math.cos(a), Math.cos(th) * Math.sin(a)], SH, 0.7]); } }
    for (let x = -15, k = 0; x >= -21; x -= sp, k++) { const rr = lerp(R, 3.4, (-15 - x) / 6), n = Math.round(2 * Math.PI * rr / sp); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; L.push([[x, Math.cos(a) * rr, Math.sin(a) * rr], [-0.4, Math.cos(a), Math.sin(a)], SH, 0.6]); } }
    const LEDC = [-2.2, -0.8], LEDR = 4.2;
    const LUM = [[5.6, -3.6, 1.0, [0.75, 0.8, 0.85]], [5.9, 0.3, 1.6, [0.3, 0.3, 0.32]], [5.0, 4.2, 1.5, 'cam'], [1.0, 6.7, 1.1, [0.3, 0.3, 0.32]]];
    const hole = (y, z) => Math.hypot(y - LEDC[0], z - LEDC[1]) < LEDR + 0.3 || LUM.some(p => Math.hypot(y - p[0], z - p[1]) < p[2] + 0.35);
    for (let r = sp; r < R - 1.9; r += sp) { const n = Math.round(2 * Math.PI * r / sp); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, y = Math.cos(a) * r, z = Math.sin(a) * r; if (!hole(y, z)) L.push([[15, y, z], [1, 0, 0], SH, 0.85]); } }
    { const n = Math.round(2 * Math.PI * LEDR / 0.4); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; L.push([[15.2, LEDC[0] + Math.cos(a) * LEDR, LEDC[1] + Math.sin(a) * LEDR], [1, 0, 0], [0.8, 0.8, 0.82], 1]); } }
    for (let y = -LEDR; y <= LEDR; y += 0.5) for (let z = -LEDR; z <= LEDR; z += 0.5) { if (Math.hypot(y, z) > LEDR - 0.4) continue; const sq = Math.abs(y) < 1.6 && Math.abs(z) < 1.6; L.push([[15.0, LEDC[0] + y, LEDC[1] + z], [1, 0, 0], sq ? [1, 0.88, 0.55] : [0.72, 0.74, 0.76], sq ? 1.2 : 0.8]); }
    LUM.forEach(([y0, z0, r, c]) => { const n = Math.round(2 * Math.PI * r / 0.35); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; L.push([[15.2, y0 + Math.cos(a) * r, z0 + Math.sin(a) * r], [1, 0, 0], [0.12, 0.12, 0.12], 1]); }
      for (let rr = 0.3; rr < r - 0.3; rr += 0.35) { const m = Math.max(1, Math.round(2 * Math.PI * rr / 0.35)); for (let j = 0; j < m; j++) { const a = j / m * Math.PI * 2; L.push([[15.05, y0 + Math.cos(a) * rr, z0 + Math.sin(a) * rr], [1, 0, 0], c === 'cam' ? (rr < 0.7 ? [0.6, 0.62, 0.7] : [0.08, 0.08, 0.1]) : c, 1]); } } });
    for (let x = -12, k = 0; x <= 8.01; x += 0.8, k++) { const n = 34; for (let j = 0; j < n; j++) { const a = (j + (k & 1) * 0.5) / n * Math.PI * 2; L.push([[x, Math.cos(a) * 5.1, Math.sin(a) * 5.1], [0, Math.cos(a), Math.sin(a)], x > -2 ? YL : [0.75, 0.75, 0.75], 1]); } }
    cloud(L, 0.55, capG);
  }
  const TR = 1.7, TN = 300, TA = 8;
  const tether = (() => { const L = []; for (let i = 0; i < TN * TA; i++) L.push([[0, 0, 0], [0, 1, 0], [0.9, 0.9, 0.9], 0.85]); return cloud(L, 0.8); })();
  const updTether = (capU) => { let n = 0; const s0 = capU * LC - 21 * CS;
    for (let i = 0; i < TN; i++) { const sArc = s0 - i * 2; let c, t;
      if (sArc > 0) { c = pAt(sArc / LC); t = tAt(sArc / LC); } else { t = tAt(0); c = pAt(0).addScaledVector(t, sArc); }
      c.y -= 12 * Math.min(1, i / 25);
      const up = Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0), n1 = t.clone().cross(up).normalize(), n2 = t.clone().cross(n1);
      for (let j = 0; j < TA; j++) { const a = (j + (i & 1) * 0.5) / TA * Math.PI * 2, co = Math.cos(a), si = Math.sin(a), k = n * 3; const nx = n1.x * co + n2.x * si, ny = n1.y * co + n2.y * si, nz = n1.z * co + n2.z * si;
        tether.P[k] = c.x + nx * TR; tether.P[k + 1] = c.y + ny * TR; tether.P[k + 2] = c.z + nz * TR; tether.N[k] = nx; tether.N[k + 1] = ny; tether.N[k + 2] = nz; tether.A[n] = sArc > -100 ? 0.85 : 0; n++; } }
    ['position', 'aN', 'aA'].forEach(q => { tether.g.attributes[q].needsUpdate = true; }); };

  // ---- end-effector: housing + EPM (N half yellow) ----
  const effG = new T3.Group();
  { const L = [], R = 80, st = 10;
    for (let y = -10, k = 0; y >= -150; y -= st, k++) { const n = Math.round(2 * Math.PI * R / st); for (let j = 0; j < n; j++) { const a = (j + (k & 1) * 0.5) / n * Math.PI * 2; L.push([[Math.cos(a) * R, y, Math.sin(a) * R], [Math.cos(a), 0, Math.sin(a)], WH, 0.4]); } }
    for (let r = st; r < R; r += st) { const n = Math.round(2 * Math.PI * r / st); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; L.push([[Math.cos(a) * r, -150, Math.sin(a) * r], [0, -1, 0], WH, 0.3]); } }
    for (let t = 0; t < 4; t++) { const y = -138 + t * 5; for (let j = 0; j < 96; j++) { const a = (j + (t & 1) * 0.5) / 96 * Math.PI * 2; L.push([[Math.cos(a) * 82, y, Math.sin(a) * 82], [Math.cos(a), 0, Math.sin(a)], [0.85, 0.6, 0.35], 0.9]); } }
    cloud(L, 3.2, effG, false, true);
    const M = [], MR = 50.8, MH = 50.8, ms = 6.5;
    for (let x = -MH, k = 0; x <= MH + 0.01; x += ms, k++) { const n = Math.round(2 * Math.PI * MR / ms); for (let j = 0; j < n; j++) { const a = (j + (k & 1) * 0.5) / n * Math.PI * 2; M.push([[x, -80 + Math.cos(a) * MR, Math.sin(a) * MR], [0, Math.cos(a), Math.sin(a)], x > 0 ? YL : WH, 1]); } }
    [-MH, MH].forEach(x => { for (let r = ms; r < MR; r += ms) { const n = Math.round(2 * Math.PI * r / ms); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; M.push([[x, -80 + Math.cos(a) * r, Math.sin(a) * r], [Math.sign(x), 0, 0], x > 0 ? YL : WH, 1]); } } });
    cloud(M, 2.8, effG, false, true); }

  // ---- KUKA LBR (URDF chain), dots pre-sampled from the link meshes ----
  const BASE = V(620, -330, -420), K = 1000, S = V(BASE.x, BASE.y + 337.5, BASE.z), LL = 399.3, FL = 126;
  const kRoot = new T3.Group(); kRoot.position.copy(BASE); kRoot.rotation.x = -Math.PI / 2; kRoot.scale.setScalar(K); scene.add(kRoot);
  const JDEF = [[0, 0, 0.3375, 0, -1], [0, 0, 0, -Math.PI / 2, 1], [0, -0.3993, 0, Math.PI / 2, -1], [0, 0, 0, -Math.PI / 2, -1], [0, -0.3993, 0, Math.PI / 2, -1], [0, 0, 0, -Math.PI / 2, 1], [0, -0.126, 0, Math.PI / 2, 1]];
  const linkG = [new T3.Group()]; kRoot.add(linkG[0]);
  const jointG = JDEF.map((j, i) => { const o = new T3.Group(); o.position.set(j[0], j[1], j[2]); o.rotation.x = j[3]; const r = new T3.Group(); o.add(r); linkG[i].add(o); linkG.push(r); return r; });
  effG.rotation.x = -Math.PI / 2; effG.position.set(0, 0, 0.045); effG.scale.setScalar(1 / K); linkG[7].add(effG);
  const setQ = (q) => q.forEach((v, i) => { jointG[i].rotation.z = v * JDEF[i][4]; });
  const setArm = (top, yaw) => {
    const Wp = top.clone().add(V(0, FL, 0)), d3 = Wp.clone().sub(S), h = Math.hypot(d3.x, d3.z), v = d3.y;
    const d = Math.min(Math.hypot(h, v), 2 * LL - 0.01), a = Math.atan2(v, h), b = Math.acos(cl(d / (2 * LL), -1, 1));
    const dir = V(d3.x / h, 0, d3.z / h), E = S.clone().addScaledVector(dir, LL * Math.cos(a + b)).add(V(0, LL * Math.sin(a + b), 0));
    const tilt = (p, q) => { const dd = q.clone().sub(p); return Math.atan2(dd.x * dir.x + dd.z * dir.z, dd.y); };
    const a1 = tilt(S, E), a2 = tilt(E, Wp), phi = Math.atan2(-dir.z, dir.x);
    setQ([-phi, a1, 0, -(a2 - a1), 0, Math.PI - a2, yaw + phi]);
  };
  // kuka-lbr-points.bin: Uint32 dot count per link (base_link, link1–7), then
  // Float32 [x, y, z, nx, ny, nz] per dot in link-local metres.
  fetch(KUKA_URL).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(buf => {
    const cnt = new Uint32Array(buf, 0, 8), D = new Float32Array(buf, 32);
    let o = 0;
    for (let li = 0; li < 8; li++) {
      const L = [];
      for (let s = 0; s < cnt[li]; s++, o += 6) L.push([[D[o], D[o + 1], D[o + 2]], [D[o + 3], D[o + 4], D[o + 5]], WH, 1]);
      cloud(L, 7.5, linkG[li], false, true);
    }
    if (!raf) draw(); // paused / still frame: show the arm as soon as it arrives
  }).catch(e => console.warn('MFE hero: robot arm unavailable:', e));

  // ---- optional field lines (dipole, EPM → capsule) ----
  const FN = 12, FS2 = 70;
  const field = (() => { const L = []; for (let i = 0; i < FN * FS2; i++) L.push([[0, 0, 0], [0, 1, 0], YL, 0]); return cloud(L, 2); })();
  const updField = (T, epm, on) => {
    field.m.visible = on; if (!on) return;
    let n = 0; const ph = (T * 0.6) % 1;
    [10, 16, 24].forEach(k => { for (let f = 0; f < 4; f++) { const phi = f / 4 * Math.PI * 2 + k;
      for (let s = 0; s < FS2; s++) { const th = 0.25 + (Math.PI - 0.5) * ((s + ph) / FS2), r = 7 * k * Math.sin(th) ** 2, x = r * Math.cos(th), rho = r * Math.sin(th);
        const kk = n * 3; field.P[kk] = epm.x + x; field.P[kk + 1] = epm.y + rho * Math.cos(phi); field.P[kk + 2] = epm.z + rho * Math.sin(phi); field.A[n] = 0.75 * Math.sin(th) ** 2; n++; } } });
    field.g.attributes.position.needsUpdate = true; field.g.attributes.aA.needsUpdate = true;
  };

  // ---- motion: 30 s loop, capsule glides under the magnet ----
  let fit = 1, yawPrev = null;
  const frame = (T) => {
    const w = 2 * Math.PI * T / LOOP;
    const capU = lerp(U0, U1, 0.5 - 0.5 * Math.cos(w)), leadU = capU + 30 / LC;
    { const tf = tAt(capU), rt = tf.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(tf); capG.position.copy(pAt(capU)); capG.quaternion.setFromRotationMatrix(new T3.Matrix4().makeBasis(tf, up, rt)); }
    const lp = pAt(leadU), epm = V(lp.x, lp.y + 150, lp.z);
    const flange = V(epm.x, epm.y + 80, epm.z), ta = tAt(leadU); ta.y = 0; ta.normalize();
    const want = Math.atan2(-ta.z, ta.x), wr = (x) => Math.atan2(Math.sin(x), Math.cos(x));
    const axAng = (y) => { setArm(flange, y); kRoot.updateMatrixWorld(true); const ax = V(1, 0, 0).transformDirection(effG.matrixWorld); return Math.atan2(-ax.z, ax.x); };
    const a0 = axAng(0), sg = Math.sign(wr(axAng(0.5) - a0)) || 1;
    let yaw = sg * wr(want - a0);
    if (yawPrev != null) yaw += 2 * Math.PI * Math.round((yawPrev - yaw) / (2 * Math.PI));
    yawPrev = yaw; setArm(flange, yaw);
    updColon(T, capU); updTether(capU);
    updField(T, epm, FIELD_LINES);
    const z = ssm(8, 12.5, T) * (1 - ssm(18.5, 23, T));
    const capP = capG.position, tgW = V(180, 110, -90), tgC = capP.clone().add(V(0, 14, 0));
    const dist = Math.exp(lerp(Math.log(1650 * fit), Math.log(210 * fit), z)), tg = tgW.clone().lerp(tgC, ssm(0, 1, z));
    const ze = ssm(0, 0.55, z); const az = (-6 + 5 * Math.sin(w) + -100 * ze) * DEG, el = (40 + 2 * Math.sin(w + 1) - 30 * ze) * DEG;
    camera.position.set(tg.x + dist * Math.sin(az) * Math.cos(el), tg.y + dist * Math.sin(el), tg.z + dist * Math.cos(az) * Math.cos(el));
    camera.near = Math.max(1, dist * 0.04); camera.far = dist * 20 + 4000; camera.updateProjectionMatrix(); camera.lookAt(tg);
    U.uCut.value = z; U.uCapD.value = camera.position.distanceTo(capP);
    const tl = TRANSITIONS;
    U.uMix.value = tl ? 0.75 * (1 - ssm(0, 3.2, T) + ssm(26.8, 30, T)) : 0; U.uTime.value = T;
    const wq = (T - 4.5) / 7.5; U.uWaveOn.value = tl && T > 4.5 && T < 26 ? ssm(4.5, 5.2, T) * (1 - ssm(25.3, 26, T)) * (1 - z) : 0; U.uWaveX.value = -120 + 400 * (wq - Math.floor(wq));
    U.uRef.value = dist; U.uScale.value = DOT_SCALE;
  };
  let t = reduce ? STILL_T : START_T;
  const draw = () => { frame(t % LOOP); renderer.render(scene, camera); };

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1, asp = w / h;
    renderer.setSize(w, h, false); camera.aspect = asp;
    const portrait = asp <= 1.25;
    fit = Math.max(1, (portrait ? 1.4 : 1.6) / asp); U.uH.value = h * 0.5 / Math.tan(camera.fov * DEG / 2);
    if (!portrait) camera.setViewOffset(w, h, -0.14 * w, 0, w, h); // 'Right' layout: clear of the title
    else camera.setViewOffset(w, h, 0.04 * w, h * 0.24, w, h); // portrait (phones): closer in, lifted above the full-width title
    camera.updateProjectionMatrix();
    if (!raf) draw(); // keep a paused / still frame correct after resizing
  };

  // ── Playback: loop, pause when off-screen or hidden ─────────────────────────
  let raf = 0, last = null, inView = true;
  const tick = (now) => {
    if (last == null) last = now;
    t += SPEED * Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    draw();
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (reduce || raf || !inView || document.hidden) return; last = null; raf = requestAnimationFrame(tick); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  resize();
  if (reduce) return;
  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; if (inView) start(); else stop(); }).observe(host);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  start();
}
