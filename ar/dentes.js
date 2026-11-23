// Dentadura procedural + fio dental que passa entre os dentes de baixo e tira a sujeira.
// Unidades locais: ~1 unidade = 1 cm. O arco inferior fica com o plano de mordida em y = 0.
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const sgnpow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const UP = new THREE.Vector3(0, 1, 0);

// Dentes de um lado do arco, do centro para trás.
const SIDE = [
  { type: 'inc', w: 0.86, d: 0.62, h: 1.0 },  // incisivo central
  { type: 'inc', w: 0.68, d: 0.6, h: 0.9 },   // incisivo lateral
  { type: 'can', w: 0.78, d: 0.78, h: 1.05 }, // canino
  { type: 'pm', w: 0.72, d: 0.82, h: 0.85 },  // pré-molares
  { type: 'pm', w: 0.7, d: 0.84, h: 0.82 },
  { type: 'mol', w: 1.06, d: 1.0, h: 0.72 },  // molares
  { type: 'mol', w: 0.98, d: 0.96, h: 0.68 },
];
const GAP = 0.035;
const EMBED = 0.2; // quanto do dente fica dentro da gengiva

/* ---------- arco dental (meia elipse percorrida por comprimento) ---------- */
function makeArch(scale) {
  const AX = 0.86, BZ = 1.0, PHI = 1.62, N = 800;
  const half = SIDE.reduce((a, t) => a + t.w, 0) + GAP * (SIDE.length - 0.5);
  const phis = [0], lens = [0];
  for (let i = 1; i <= N; i++) {
    const a0 = (PHI * (i - 1)) / N, a1 = (PHI * i) / N;
    const dx = AX * (Math.sin(a1) - Math.sin(a0)), dz = BZ * (Math.cos(a1) - Math.cos(a0));
    phis.push(a1); lens.push(lens[i - 1] + Math.hypot(dx, dz));
  }
  const unitLen = lens[N];
  const k = ((half + 0.35) / unitLen) * scale;
  const zOff = -k * BZ * (1 + Math.cos(PHI)) / 2;
  const phiAt = (s) => { // s em unidades reais, com sinal (negativo = lado esquerdo)
    const u = Math.min(Math.abs(s) / k, unitLen);
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lens[m] < u) lo = m; else hi = m; }
    const f = (u - lens[lo]) / (lens[hi] - lens[lo] || 1);
    return Math.sign(s || 1) * lerp(phis[lo], phis[hi], f);
  };
  const at = (s) => {
    const phi = phiAt(s);
    const p = new THREE.Vector3(k * AX * Math.sin(phi), 0, k * BZ * Math.cos(phi) + zOff);
    const t = new THREE.Vector3(AX * Math.cos(phi), 0, -BZ * Math.sin(phi)).normalize();
    const n = new THREE.Vector3(Math.sin(phi) / AX, 0, Math.cos(phi) / BZ).normalize();
    return { p, t, n };
  };
  return { at, half: half * scale, end: (half + 0.35) * scale, backZ: k * BZ * Math.cos(PHI) + zOff };
}

/* ---------- geometria dos dentes ---------- */
const geoCache = new Map();
function toothGeo(spec) {
  const key = `${spec.type}-${spec.w}-${spec.d}-${spec.h}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const { type, w, d, h } = spec;
  const g = new THREE.SphereGeometry(1, 40, 30);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = sgnpow(v.x, 0.62), y = sgnpow(v.y, 0.8), z = sgnpow(v.z, 0.62);
    const hh = (y + 1) / 2; // 0 = colo, 1 = ponta
    const neck = 1 - 0.24 * Math.pow(1 - hh, 2);
    x *= neck; z *= neck;
    if (type === 'inc') {
      z *= lerp(1, 0.3, smooth(0.2, 1, hh));
      x *= 1 + 0.07 * hh;
    } else if (type === 'can') {
      const tip = smooth(0.45, 1, hh);
      x *= lerp(1, 0.32, tip * tip);
      z *= lerp(1, 0.55, tip);
      y += 0.12 * tip * (1 - Math.abs(x));
    } else if (type === 'pm') {
      if (y > 0) y -= 0.3 * smooth(0.55, 1, hh) * (1 - Math.abs(Math.sin(Math.PI * z)));
    } else if (y > 0) {
      y -= 0.34 * smooth(0.5, 1, hh) * (1 - Math.abs(Math.sin(Math.PI * x) * Math.sin(Math.PI * z)));
    }
    p.setXYZ(i, (x * w) / 2 * 0.97, ((y + 1) / 2) * h, (z * d) / 2);
  }
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

/* ---------- gengiva (perfil varrido ao longo do arco) ---------- */
function gumGeo(arch, dir) {
  const S = 140, J = 28, pos = [], idx = [];
  for (let i = 0; i <= S; i++) {
    const s = lerp(-arch.end, arch.end, i / S);
    const { p, n } = arch.at(s);
    const a = Math.abs(s) / arch.end;
    const taper = Math.sqrt(Math.max(0.02, 1 - Math.pow(smooth(0.86, 1, a), 2)));
    const rx = lerp(0.46, 0.64, a) * taper, ry = 0.56 * taper;
    for (let j = 0; j < J; j++) {
      const ang = (j / J) * Math.PI * 2;
      const pn = Math.cos(ang) * rx, py = (Math.sin(ang) * ry - 0.42) * dir;
      pos.push(p.x + n.x * pn, p.y + py, p.z + n.z * pn);
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < J; j++) {
    const a = i * J + j, b = (i + 1) * J + j, c = i * J + ((j + 1) % J), e = (i + 1) * J + ((j + 1) % J);
    idx.push(a, b, c, b, e, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function innerShape(arch, inset) {
  const shape = new THREE.Shape();
  const S = 60;
  for (let i = 0; i <= S; i++) {
    const s = lerp(-arch.half, arch.half, i / S);
    const { p, n } = arch.at(s);
    const x = p.x - n.x * inset, z = p.z - n.z * inset;
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }
  const g = new THREE.ShapeGeometry(shape, 24);
  g.rotateX(Math.PI / 2);
  return g;
}

/* ---------- um arco completo (dentes + gengiva) ---------- */
function buildArch({ scale, dir, mats }) {
  const arch = makeArch(scale);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(gumGeo(arch, dir), mats.gum));
  const floor = new THREE.Mesh(innerShape(arch, 0.35), dir > 0 ? mats.tongue : mats.palate);
  floor.position.y = dir > 0 ? -0.5 : 0.62;
  group.add(floor);

  const teeth = [], gaps = [];
  const seq = [...SIDE].reverse().map((t) => ({ ...t, side: -1 })).concat(SIDE.map((t) => ({ ...t, side: 1 })));
  let s = -arch.half;
  seq.forEach((spec, i) => {
    const w = spec.w * scale;
    const sc = s + w / 2;
    const { p, t, n } = arch.at(sc);
    const mesh = new THREE.Mesh(toothGeo(spec), mats.teeth[i % mats.teeth.length]);
    mesh.scale.setScalar(scale);
    const basis = new THREE.Matrix4().makeBasis(t, UP, n);
    mesh.quaternion.setFromRotationMatrix(basis);
    if (dir < 0) mesh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
    mesh.position.copy(p).addScaledVector(UP, -EMBED * dir);
    mesh.userData.spec = spec;
    group.add(mesh); teeth.push(mesh);
    s += w;
    if (i < seq.length - 1) {
      const gs = s + (GAP * scale) / 2;
      const g = arch.at(gs);
      g.s = gs; g.depth = (Math.max(spec.d, seq[i + 1].d) * scale) / 2;
      gaps.push(g);
      // papila de gengiva entre os dentes
      const pap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mats.gum);
      pap.scale.set(0.11, 0.2, g.depth * 0.7);
      pap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(g.t, UP, g.n));
      pap.position.copy(g.p).addScaledVector(UP, -0.03 * dir);
      group.add(pap);
      s += GAP * scale;
    }
  });
  return { group, arch, teeth, gaps };
}

/* ---------- texturas pequenas ---------- */
function sparkleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(190,250,255,.6)'); g.addColorStop(1, 'rgba(190,250,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#fff';
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = i % 2 ? 9 : 62;
    x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ================================================================== */
export function createDenture({ onProgress } = {}) {
  const mats = {
    gum: new THREE.MeshPhysicalMaterial({ color: '#d9687c', roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: new THREE.Color('#ffb3c0'), side: THREE.DoubleSide }),
    tongue: new THREE.MeshStandardMaterial({ color: '#b9485e', roughness: 0.7, side: THREE.DoubleSide }),
    palate: new THREE.MeshStandardMaterial({ color: '#c95a6e', roughness: 0.6, side: THREE.DoubleSide }),
    teeth: ['#f6f2e7', '#f2ecdf', '#f8f5ec'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.12, sheen: 0.3 })),
    floss: new THREE.MeshStandardMaterial({ color: '#e9fbff', emissive: '#5fd6e8', emissiveIntensity: 0.35, roughness: 0.4 }),
    dirt: ['#c9a24a', '#a07a3c', '#7d9a3e', '#d8c27a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })),
  };

  const root = new THREE.Group();     // gira com o arraste
  const lower = buildArch({ scale: 1, dir: 1, mats });
  root.add(lower.group);

  // Arco de cima, articulado atrás e aberto para mostrar o de baixo.
  const upper = buildArch({ scale: 1.04, dir: -1, mats });
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.15, lower.arch.backZ);
  upper.group.position.set(0, 1.55, -lower.arch.backZ);
  hinge.add(upper.group);
  root.add(hinge);
  let openTarget = 0.5, open = 0.5;
  hinge.rotation.x = -open;

  /* ----- sujeira entre os dentes de baixo ----- */
  const gaps = lower.gaps;
  const dirtGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.75 + Math.random() * 0.5), p.getY(i) * (0.75 + Math.random() * 0.5), p.getZ(i) * (0.75 + Math.random() * 0.5));
    g.computeVertexNormals(); return g;
  })();
  const dirtGroup = new THREE.Group(); root.add(dirtGroup);
  const particles = [];
  gaps.forEach((g, gi) => {
    const count = 7 + Math.floor(Math.random() * 4);
    for (let k = 0; k < count; k++) {
      const m = new THREE.Mesh(dirtGeo, mats.dirt[Math.floor(Math.random() * mats.dirt.length)]);
      const size = 0.035 + Math.random() * 0.045;
      const home = g.p.clone()
        .addScaledVector(g.t, (Math.random() - 0.5) * 0.06)
        .addScaledVector(g.n, (Math.random() - 0.5) * g.depth * 1.5)
        .addScaledVector(UP, 0.08 + Math.random() * 0.5);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      dirtGroup.add(m);
      particles.push({ mesh: m, gap: gi, size, home, vel: new THREE.Vector3(), state: 'stuck', t: 0, delay: 0, order: k / count });
    }
  });

  /* ----- brilho de "limpo" ----- */
  const sparkMat = new THREE.SpriteMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = [];
  function sparkle(gap) {
    const sp = new THREE.Sprite(sparkMat.clone());
    sp.position.copy(gap.p).addScaledVector(UP, 0.55).addScaledVector(gap.n, gap.depth * 0.6);
    root.add(sp); sparks.push({ sp, t: 0 });
  }

  /* ----- fio dental ----- */
  let flossMesh = null;
  function drawFloss(c, g, side) {
    const lab = g.n.clone(), up = UP;
    const reach = g.depth + 0.14;
    const pts = [
      c.clone().addScaledVector(lab, reach + 1.3).addScaledVector(up, 2.4),
      c.clone().addScaledVector(lab, reach + 0.35).addScaledVector(up, 0.55),
      c.clone().addScaledVector(lab, reach).addScaledVector(up, 0.06),
      c.clone().addScaledVector(g.t, side * 0.004),
      c.clone().addScaledVector(lab, -reach).addScaledVector(up, 0.06),
      c.clone().addScaledVector(lab, -reach - 0.35).addScaledVector(up, 0.55),
      c.clone().addScaledVector(lab, -reach - 1.3).addScaledVector(up, 2.4),
    ];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3), 90, 0.016, 6, false);
    if (flossMesh) { flossMesh.geometry.dispose(); flossMesh.geometry = geo; }
    else { flossMesh = new THREE.Mesh(geo, mats.floss); root.add(flossMesh); }
  }

  /* ----- máquina de estados do fio ----- */
  const ORDER = (() => { const mid = Math.floor(gaps.length / 2); const o = []; for (let i = mid; i < gaps.length; i++) o.push(i); for (let i = mid - 1; i >= 0; i--) o.push(i); return o; })();
  const HOVER = 1.45, BOTTOM = 0.1, CONTACT = 0.62;
  const DUR = { move: 0.75, down: 0.7, saw: 1.9, up: 0.45, rest: 3.2 };
  const clean = new Array(gaps.length).fill(false);
  const st = { phase: 'move', t: 0, gap: ORDER[0], fromS: gaps[ORDER[0]].s - 0.8, s: 0, y: HOVER, wiggle: 0, requested: null, paused: false };

  const nextGap = () => {
    if (st.requested !== null) { const r = st.requested; st.requested = null; return r; }
    const pos = ORDER.indexOf(st.gap);
    for (let k = 1; k <= ORDER.length; k++) { const g = ORDER[(pos + k) % ORDER.length]; if (!clean[g]) return g; }
    return null;
  };
  const report = () => onProgress && onProgress(clean.filter(Boolean).length, gaps.length);

  function releaseDirt(gi, sawProgress) {
    for (const pt of particles) {
      if (pt.gap !== gi || pt.state !== 'stuck' || pt.order > sawProgress) continue;
      const g = gaps[gi], side = Math.random() < 0.5 ? -1 : 1;
      pt.state = 'flying'; pt.t = 0;
      pt.vel.copy(g.n).multiplyScalar(side * (0.7 + Math.random() * 0.9))
        .addScaledVector(UP, 1.1 + Math.random() * 1.0)
        .addScaledVector(g.t, (Math.random() - 0.5) * 0.6);
    }
  }

  function finishGap(gi) {
    if (clean[gi]) return;
    clean[gi] = true; sparkle(gaps[gi]); report();
  }

  function update(dt) {
    dt = Math.min(dt, 0.1);
    open = lerp(open, openTarget, 1 - Math.exp(-dt * 6));
    hinge.rotation.x = -open;

    if (!st.paused) {
      st.t += dt;
      const g = gaps[st.gap];
      const p = st.phase;
      if (p === 'move') {
        const k = ease(clamp01(st.t / DUR.move));
        st.s = lerp(st.fromS, g.s, k); st.y = HOVER; st.wiggle = 0;
        if (st.t >= DUR.move) { st.phase = 'down'; st.t = 0; }
      } else if (p === 'down') {
        const k = clamp01(st.t / DUR.down);
        // desce devagar até o ponto de contato e "estala" passando por ele
        st.y = k < 0.6 ? lerp(HOVER, CONTACT + 0.06, ease(k / 0.6)) : lerp(CONTACT + 0.06, BOTTOM, smooth(0.6, 0.78, k));
        st.s = g.s;
        if (st.t >= DUR.down) { st.phase = 'saw'; st.t = 0; }
      } else if (p === 'saw') {
        const k = clamp01(st.t / DUR.saw);
        st.y = BOTTOM + 0.22 * (0.5 - 0.5 * Math.cos(k * Math.PI * 2 * 3));
        st.wiggle = Math.sin(k * Math.PI * 2 * 7) * 0.12;
        releaseDirt(st.gap, k * 1.15);
        if (st.t >= DUR.saw) { finishGap(st.gap); st.phase = 'up'; st.t = 0; }
      } else if (p === 'up') {
        const k = ease(clamp01(st.t / DUR.up));
        st.y = lerp(BOTTOM, HOVER, k); st.wiggle = 0;
        if (st.t >= DUR.up) {
          const n = nextGap();
          if (n === null) { st.phase = 'rest'; st.t = 0; }
          else { st.fromS = g.s; st.gap = n; st.phase = 'move'; st.t = 0; }
        }
      } else if (p === 'rest') {
        st.y = HOVER + Math.sin(st.t * 2) * 0.05;
        if (st.t >= DUR.rest) { reset(); }
      }
    }

    const at = lower.arch.at(st.s);
    const g = gaps[st.gap];
    const c = at.p.clone().addScaledVector(UP, st.y).addScaledVector(g.n, st.wiggle);
    drawFloss(c, { ...g, n: at.n, t: at.t }, st.wiggle > 0 ? 1 : -1);

    // partículas de sujeira
    for (const pt of particles) {
      const m = pt.mesh;
      if (pt.state === 'stuck') {
        m.position.copy(pt.home); m.scale.setScalar(pt.size); m.visible = true;
      } else if (pt.state === 'popping') {
        pt.t += dt;
        const k = clamp01((pt.t - pt.delay) / 0.35);
        m.visible = true; m.position.copy(pt.home);
        m.scale.setScalar(pt.size * (k < 1 ? Math.sin(k * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1));
        if (k >= 1) pt.state = 'stuck';
      } else if (pt.state === 'flying') {
        pt.t += dt;
        pt.vel.y -= 5.5 * dt;
        m.position.addScaledVector(pt.vel, dt);
        m.rotation.x += dt * 6; m.rotation.y += dt * 4;
        m.scale.setScalar(pt.size * (1 - smooth(0.5, 1.3, pt.t)));
        if (pt.t > 1.3) { pt.state = 'gone'; m.visible = false; }
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.t += dt;
      const k = s.t / 0.9;
      s.sp.scale.setScalar(0.25 + k * 0.55);
      s.sp.material.opacity = 1 - k;
      s.sp.material.rotation = k * 1.5;
      if (k >= 1) { root.remove(s.sp); s.sp.material.dispose(); sparks.splice(i, 1); }
    }
  }

  function reset() {
    clean.fill(false);
    particles.forEach((pt) => { pt.state = 'popping'; pt.t = 0; pt.delay = Math.random() * 0.6; pt.mesh.scale.setScalar(0); });
    st.fromS = gaps[st.gap].s; st.gap = ORDER[0]; st.phase = 'move'; st.t = 0; st.requested = null;
    report();
  }

  // Toque: num dente de baixo ou na sujeira vai para o vão mais próximo; no arco de cima abre/fecha a boca.
  function handleTap(raycaster) {
    const lowerHits = raycaster.intersectObjects([...lower.teeth, dirtGroup], true);
    const upperHits = raycaster.intersectObjects(upper.teeth, false);
    if (upperHits.length && (!lowerHits.length || upperHits[0].distance < lowerHits[0].distance)) {
      openTarget = openTarget > 0.4 ? 0.12 : 0.5;
      return 'boca';
    }
    if (!lowerHits.length) return null;
    const local = root.worldToLocal(lowerHits[0].point.clone());
    let best = -1, bd = Infinity;
    gaps.forEach((g, i) => { const d = g.p.distanceTo(local) + (clean[i] ? 0.6 : 0); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return null;
    if (clean[best]) { // vão limpo: suja só ele de novo para dar pra ver outra vez
      clean[best] = false;
      particles.forEach((pt) => { if (pt.gap === best) { pt.state = 'popping'; pt.t = 0; pt.delay = Math.random() * 0.3; } });
      report();
    }
    if (openTarget < 0.4) openTarget = 0.5;
    st.requested = best;
    if (st.phase === 'down' || st.phase === 'saw') { st.phase = 'up'; st.t = 0; }
    else if (st.phase === 'move' || st.phase === 'rest') { st.fromS = st.s; st.gap = best; st.requested = null; st.phase = 'move'; st.t = 0; }
    return 'vao';
  }

  report();
  return {
    root,
    update,
    reset,
    handleTap,
    setPaused(v) { st.paused = v; },
    get paused() { return st.paused; },
    total: gaps.length,
  };
}
