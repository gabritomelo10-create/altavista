import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VERTICAL, P01, AVRA } from './brand-paths.js';

const HEX = { mata: '#193C30', floresta: '#284B3B', oliva: '#667451', salvia: '#A0AD91', dourado: '#B79A58', douradoClaro: '#D7C18C', mineral: '#E8E3D5' };
const VB = { vertical: [330, 178, 620, 480], symbol: [462, 181, 355, 313], p01: [486, 210, 794, 400], avra: [30, 36, 3441, 558] };
const PATHS = {
  vertical: [VERTICAL.symbol, VERTICAL.lettering, VERTICAL.residence],
  symbol: [VERTICAL.symbol],
  p01: [P01.d],
  avra: [AVRA.d],
};

const CAPTIONS = [
  ['Totem de entrada', 'Monólito Oliva com símbolo e lettering em relevo dourado, ao lado do muro de pedra com o símbolo. Clique para anoitecer.'],
  ['Recepção do pavilhão', 'Relevo dourado escovado com luz de fundo sobre parede mineral e balcão de madeira. Clique para acender o halo.'],
  ['Kit de apresentação', 'Caixa Mineral com P01 em baixo-relevo e endosso AVRA; pasta Mata com foil dourado por dentro. Clique para abrir.'],
  ['Caderno Mata', 'Capa em couro Mata com o símbolo em foil dourado e elástico. Clique para abrir.'],
  ['Crachá', 'Mata com assinatura em foil dourado e endosso AVRA Incorporadora. Arraste para balançar, clique para girar.'],
  ['Chaveiro', 'O símbolo em metal dourado maciço. Arraste para girar, clique para lançar.'],
];

/* ---------------- helpers de canvas ---------------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function drawBrand(ctx, kind, cx, cy, width, fill, { sx = 1, sy = 1 } = {}) {
  const [x, y, w, h] = VB[kind];
  const s = width / w;
  ctx.save();
  ctx.translate(cx - (width * sx) / 2, cy - (h * s * sy) / 2);
  ctx.scale(s * sx, s * sy);
  ctx.translate(-x, -y);
  ctx.fillStyle = fill;
  PATHS[kind].forEach((d) => ctx.fill(new Path2D(d), 'evenodd'));
  ctx.restore();
}
function noise(ctx, w, h, amt = 14, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; d[i + 3] = d[i + 3] * alpha; }
  ctx.putImageData(img, 0, 0);
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function goldCss(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#9c8048'); g.addColorStop(0.35, HEX.dourado); g.addColorStop(0.55, HEX.douradoClaro); g.addColorStop(0.75, HEX.dourado); g.addColorStop(1, '#8f7442');
  return g;
}
function spaced(ctx, text, x, y, spacing) {
  const chars = [...text]; let total = 0;
  chars.forEach((ch) => { total += ctx.measureText(ch).width + spacing; });
  total -= spacing;
  let cx = x - total / 2;
  chars.forEach((ch) => { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; });
}
function plaster(ctx, w, h, base, dots = 2600) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < dots; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,250'},${Math.random() * 0.06})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 5, 0, 7); ctx.fill(); }
  noise(ctx, w, h, 16);
}
function reliefLogo(kind, mat, depth = 14) {
  const g = new THREE.Group();
  PATHS[kind].forEach((d) => shapesOf(d).forEach((sh) => {
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 0.6, bevelSegments: 3, curveSegments: 18 }), mat));
  }));
  return g;
}
function shapesOf(d) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="${d}"/></svg>`);
  return SVGLoader.createShapes(data.paths[0]);
}

/* ---------------- materiais compartilhados ---------------- */
function brushedGold(rough = 0.34) {
  return new THREE.MeshPhysicalMaterial({ color: HEX.dourado, metalness: 1, roughness: rough, anisotropy: 0.7, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 1.25 });
}

export function initStudio(canvasEl, { onSelect }) {
  const gl = canvasEl.getContext('webgl2') || canvasEl.getContext('webgl');
  if (!gl) throw new Error('WebGL indisponível');
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.2, 9);
  const camTarget = new THREE.Vector3(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xfff4dd, 0x193c30, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d0, 2.6);
  key.position.set(3.5, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 25 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa0ad91, 1.6); rim.position.set(-5, 2, -4); scene.add(rim);
  const warm = new THREE.PointLight(0xd7c18c, 12, 12, 1.5); warm.position.set(-2.5, 1.5, 3); scene.add(warm);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const items = [makeTotem(), makeSign(), makeKit(), makeNotebook(), makeBadge(), makeKeychain()];
  items.forEach((it) => { it.group.visible = false; scene.add(it.group); it.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); });

  /* ---------- seleção ---------- */
  let current = -1;
  const { gsap } = window;
  function select(i) {
    if (i === current) return;
    const prev = items[current];
    if (prev) {
      const g = prev.group;
      gsap.to(g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.55, ease: 'power3.in', onComplete: () => { g.visible = false; } });
      gsap.to(g.rotation, { y: g.rotation.y + 1.2, duration: 0.55, ease: 'power3.in' });
    }
    current = i;
    const it = items[i];
    it.reset?.();
    it.group.visible = true;
    it.spin.rotation.set(it.rest?.x ?? 0, it.rest?.y ?? 0, 0);
    gsap.fromTo(it.group.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1.3, delay: prev ? 0.4 : 0, ease: 'expo.out' });
    gsap.fromTo(it.group.rotation, { y: -1.4 }, { y: 0, duration: 1.6, delay: prev ? 0.4 : 0, ease: 'expo.out' });
    // em telas largas o objeto fica à direita, longe do título
    const shift = camera.aspect > 1.25 ? (it.shift ?? 1.25) : 0;
    gsap.to(camera.position, { ...it.cam.pos, x: it.cam.pos.x - shift, duration: 1.6, ease: 'expo.inOut' });
    gsap.to(camTarget, { ...it.cam.target, x: it.cam.target.x - shift, duration: 1.6, ease: 'expo.inOut' });
    gsap.to(ground.position, { y: it.groundY ?? -1.5, duration: 1.2, ease: 'expo.inOut' });
    gsap.to(ground.material, { opacity: it.groundY === null ? 0 : 0.28, duration: 0.8 });
    drag.vx = drag.vy = 0;
    onSelect?.(i, CAPTIONS[i]);
  }

  /* ---------- arrastar / clicar ---------- */
  const drag = { down: false, x: 0, y: 0, vx: 0, vy: 0, moved: 0, idle: 0 };
  canvasEl.addEventListener('pointerdown', (e) => { drag.down = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; canvasEl.setPointerCapture(e.pointerId); });
  canvasEl.addEventListener('pointermove', (e) => {
    if (!drag.down) return;
    const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.vx = dx * 0.006; drag.vy = dy * 0.004; drag.idle = 0;
    items[current]?.onDrag?.(dx, dy);
  });
  const up = () => {
    if (!drag.down) return;
    drag.down = false;
    if (drag.moved < 6) items[current]?.click?.();
  };
  canvasEl.addEventListener('pointerup', up);
  canvasEl.addEventListener('pointercancel', up);

  /* ---------- loop ---------- */
  function layout() {
    const w = canvasEl.clientWidth; const h = canvasEl.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < 760 ? 42 : 30;
    camera.updateProjectionMatrix();
  }
  layout(); addEventListener('resize', layout);

  let active = false;
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!active || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;
    const it = items[current];
    if (it) {
      drag.idle += dt;
      if (!drag.down) { drag.vx *= 0.94; drag.vy *= 0.92; }
      const s = it.spin;
      if (it.freeSpin) {
        s.rotation.y += drag.vx + (drag.idle > 2 && !drag.down ? dt * 0.25 : 0);
        s.rotation.x = THREE.MathUtils.clamp(s.rotation.x + drag.vy, -0.6, 0.6);
        s.rotation.x += ((it.rest?.x ?? 0) - s.rotation.x) * (drag.down ? 0 : 0.02);
      } else if (it.limitSpin) {
        s.rotation.y = THREE.MathUtils.clamp(s.rotation.y + drag.vx, -it.limitSpin, it.limitSpin);
        if (!drag.down) s.rotation.y += ((it.rest?.y ?? 0) + Math.sin(t * 0.4) * 0.12 - s.rotation.y) * 0.02;
        s.rotation.x = THREE.MathUtils.clamp(s.rotation.x + drag.vy * 0.5, -0.3, 0.3);
        if (!drag.down) s.rotation.x += ((it.rest?.x ?? 0) - s.rotation.x) * 0.03;
      }
      it.update?.(dt, t);
    }
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }
  frame();
  select(0);

  return { select, setActive(v) { active = v; } };
}

/* =================================================================
   0 · LETREIRO DO PAVILHÃO
================================================================= */
function makeSign() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  spin.scale.setScalar(0.72);

  // parede mineral com textura de reboco
  const [wc, wx] = canvas(1024, 640);
  wx.fillStyle = HEX.mineral; wx.fillRect(0, 0, 1024, 640);
  for (let i = 0; i < 2600; i++) { wx.fillStyle = `rgba(${Math.random() < 0.5 ? '120,110,90' : '255,255,250'},${Math.random() * 0.07})`; wx.beginPath(); wx.arc(Math.random() * 1024, Math.random() * 640, Math.random() * 6, 0, 7); wx.fill(); }
  noise(wx, 1024, 640, 18);
  const wallTex = tex(wc);
  const [bc, bx] = canvas(512, 320); bx.drawImage(wc, 0, 0, 512, 320);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 5.4, 0.2), new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: tex(bc, false), bumpScale: 2.5, roughness: 0.92 }));
  wall.position.z = -0.25; spin.add(wall);

  // painéis de madeira laterais
  const [mc, mx] = canvas(256, 1024);
  const wg = mx.createLinearGradient(0, 0, 256, 0); wg.addColorStop(0, '#6b4a2e'); wg.addColorStop(0.5, '#8a6440'); wg.addColorStop(1, '#5e4027');
  mx.fillStyle = wg; mx.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 90; i++) { mx.strokeStyle = `rgba(40,25,10,${Math.random() * 0.25})`; mx.lineWidth = Math.random() * 3; mx.beginPath(); const x = Math.random() * 256; mx.moveTo(x, 0); mx.bezierCurveTo(x + 10, 300, x - 10, 700, x + 4, 1024); mx.stroke(); }
  const woodMat = new THREE.MeshStandardMaterial({ map: tex(mc), roughness: 0.6 });
  [-4.15, 4.15].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.4, 0.35), woodMat); p.position.set(x, 0, -0.1); spin.add(p); });

  // halo de luz atrás das letras (retroiluminação).
  // O desfoque é feito reduzindo e ampliando o canvas: ctx.filter não existe no Safari.
  const blurred = (scale) => {
    const [sc, sx] = canvas(Math.round(1240 / scale), Math.round(960 / scale));
    drawBrand(sx, 'vertical', sc.width / 2, sc.height / 2, 1000 / scale, 'rgba(255,214,150,1)');
    return sc;
  };
  const [hc, hx] = canvas(1240, 960);
  hx.imageSmoothingEnabled = true; hx.imageSmoothingQuality = 'high';
  hx.globalAlpha = 0.55; hx.drawImage(blurred(24), 0, 0, 1240, 960);
  hx.globalAlpha = 0.45; hx.drawImage(blurred(10), 0, 0, 1240, 960);
  const haloMat = new THREE.MeshBasicMaterial({ map: tex(hc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  // mesmo enquadramento do logo em relevo: 1000 px do canvas = 620 unidades do SVG
  const halo = new THREE.Mesh(new THREE.PlaneGeometry((1240 / 1000) * 620 * 0.0062, (960 / 1000) * 620 * 0.0062), haloMat);
  halo.position.set(0, 0.25, -0.14); spin.add(halo);

  // logo em relevo
  const logo = new THREE.Group();
  const mat = brushedGold(0.36);
  PATHS.vertical.forEach((d) => {
    shapesOf(d).forEach((sh) => {
      const g = new THREE.ExtrudeGeometry(sh, { depth: 14, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 0.6, bevelSegments: 3, curveSegments: 18 });
      logo.add(new THREE.Mesh(g, mat));
    });
  });
  const s = 0.0062;
  logo.scale.set(s, -s, s);
  logo.position.set(-640 * s, 418 * s + 0.25, -0.1);
  spin.add(logo);

  // balcão de madeira com faixa de luz
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 1.5), woodMat);
  deskTop.position.set(0, -1.95, 1.25); spin.add(deskTop);
  const [dc, dx] = canvas(512, 160); plaster(dx, 512, 160, '#e9e2d2', 400);
  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.1, 1.3), new THREE.MeshStandardMaterial({ map: tex(dc), roughness: 0.9 }));
  deskBody.position.set(0, -2.6, 1.25); spin.add(deskBody);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  strip.position.set(0, -2.07, 1.91); spin.add(strip);

  const spot = new THREE.SpotLight(0xffe9c4, 60, 12, 0.55, 0.6, 1.4);
  spot.position.set(0, 4.2, 2.6); spot.target.position.set(0, 0.3, -0.2);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
  spin.add(spot, spot.target);

  let lit = false;
  const it = {
    group, spin, limitSpin: 0.7, rest: { x: 0, y: -0.18 }, groundY: null, shift: 2.0,
    cam: { pos: { x: 0, y: 0.3, z: 10.5 }, target: { x: 0, y: 0.1, z: 0 } },
    reset() { lit = true; haloMat.opacity = 0; window.gsap.to(haloMat, { opacity: 0.32, duration: 2.4, delay: 1, ease: 'power2.inOut' }); },
    click() { lit = !lit; window.gsap.to(haloMat, { opacity: lit ? 0.32 : 0, duration: 1.2, ease: 'power2.inOut' }); window.gsap.to(spot, { intensity: lit ? 60 : 110, duration: 1.2 }); },
    update(dt, t) { spot.position.x = Math.sin(t * 0.5) * 1.2; },
  };
  return it;
}

/* =================================================================
   TOTEM DE ENTRADA
================================================================= */
function makeTotem() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  group.position.y = -1.9;

  // monólito Oliva, reboco texturizado
  const [oc, ox] = canvas(512, 900); plaster(ox, 512, 900, '#3f4a2b', 3000);
  const [ob, obx] = canvas(256, 450); obx.drawImage(oc, 0, 0, 256, 450);
  const olive = new THREE.MeshStandardMaterial({ map: tex(oc), bumpMap: tex(ob, false), bumpScale: 2, roughness: 1 });
  const W = 2.5; const H = 4.3; const D = 0.8;
  const mono = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), olive);
  mono.position.set(0.6, H / 2, 0); spin.add(mono);

  const gold = brushedGold(0.32);
  const logo = reliefLogo('vertical', gold, 12);
  const ls = 0.0034; logo.scale.set(ls, -ls, ls);
  logo.position.set(0.6 - 640 * ls, H * 0.62 + 418 * ls, D / 2 - 0.01);
  spin.add(logo);

  // muro de pedra (travertino) com o símbolo
  const [sc, sx] = canvas(1024, 400);
  sx.fillStyle = '#c2ad86'; sx.fillRect(0, 0, 1024, 400);
  for (let i = 0; i < 5000; i++) { sx.fillStyle = `rgba(${Math.random() < 0.6 ? '140,115,80' : '255,250,235'},${Math.random() * 0.25})`; sx.beginPath(); sx.ellipse(Math.random() * 1024, Math.random() * 400, Math.random() * 4 + 0.5, Math.random() * 2 + 0.3, 0, 0, 7); sx.fill(); }
  sx.strokeStyle = 'rgba(120,100,70,.35)'; sx.lineWidth = 2;
  [200, 0].forEach((y) => { sx.beginPath(); sx.moveTo(0, y + 200); sx.lineTo(1024, y + 200); sx.stroke(); });
  [256, 640].forEach((x) => { sx.beginPath(); sx.moveTo(x, 0); sx.lineTo(x, 200); sx.stroke(); });
  [430, 860].forEach((x) => { sx.beginPath(); sx.moveTo(x, 200); sx.lineTo(x, 400); sx.stroke(); });
  noise(sx, 1024, 400, 14);
  const [sb, sbx] = canvas(512, 200); sbx.drawImage(sc, 0, 0, 512, 200);
  const stone = new THREE.MeshStandardMaterial({ map: tex(sc), bumpMap: tex(sb, false), bumpScale: 4, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.9, 0.7), stone);
  wall.position.set(-2.2, 0.95, -0.35); spin.add(wall);
  const sym = reliefLogo('symbol', gold, 10);
  const ss = 0.0022; sym.scale.set(ss, -ss, ss);
  sym.position.set(-2.9 - 639.5 * ss, 1.05 + 337.5 * ss, 0.0);
  spin.add(sym);

  // canteiro com folhagem estilizada
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f4423', roughness: 0.8, side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(0.035, 0.5); leafGeo.translate(0, 0.25, 0);
  const leaves = new THREE.Group();
  for (let i = 0; i < 260; i++) {
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.position.set(-4 + Math.random() * 6.6, 0, 0.45 + Math.random() * 0.9);
    l.rotation.set((Math.random() - 0.5) * 0.9, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9);
    l.scale.setScalar(0.5 + Math.random() * 0.7);
    l.userData.p = Math.random() * 6;
    leaves.add(l);
  }
  spin.add(leaves);

  // luz de chão (anoitecer)
  const up = new THREE.SpotLight(0xffd9a0, 0, 9, 0.5, 0.7, 1.2);
  up.position.set(0.6, 0.05, 1.6); up.target.position.set(0.6, 3.4, 0.4);
  spin.add(up, up.target);
  const wash = new THREE.PointLight(0xffc98a, 0, 4, 2); wash.position.set(-2.2, 0.2, 0.6); spin.add(wash);

  let night = false;
  return {
    group, spin, limitSpin: 0.85, rest: { x: 0, y: -0.35 }, groundY: -1.9, shift: 1.2,
    cam: { pos: { x: 0, y: 0.4, z: 11 }, target: { x: 0, y: 0.2, z: 0 } },
    reset() { night = false; up.intensity = 0; wash.intensity = 0; },
    click() {
      night = !night;
      window.gsap.to(up, { intensity: night ? 70 : 0, duration: 1.6, ease: 'power2.inOut' });
      window.gsap.to(wash, { intensity: night ? 6 : 0, duration: 1.6, ease: 'power2.inOut' });
    },
    update(dt, t) { leaves.children.forEach((l) => { l.rotation.z = Math.sin(t * 1.4 + l.userData.p) * 0.12; }); },
  };
}

/* =================================================================
   KIT DE APRESENTAÇÃO (caixa + pasta)
================================================================= */
function makeKit() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  group.position.y = -0.9;
  const W = 3.2; const L = 4.0; const Hb = 0.55; const lidH = 0.32;

  // tampa: Mineral, logo Mata, endosso AVRA, P01 em baixo-relevo
  const CW = 1280; const CH = 1600;
  const [lc, lx] = canvas(CW, CH); const [lb, lbx] = canvas(CW / 2, CH / 2);
  lx.fillStyle = '#ddd5c2'; lx.fillRect(0, 0, CW, CH); noise(lx, CW, CH, 7);
  drawBrand(lx, 'vertical', CW / 2, 430, 620, HEX.mata);
  lx.fillStyle = HEX.dourado; lx.fillRect(CW / 2 - 60, 720, 120, 3);
  drawEndorseCentered(lx, CW / 2, 800, 420, HEX.mata);
  lx.save(); lx.globalAlpha = 0.07; lx.translate(0, CH); lx.rotate(-Math.PI / 2); drawBrand(lx, 'p01', 300, 380, 1500, '#6a6252'); lx.restore();
  lbx.fillStyle = '#808080'; lbx.fillRect(0, 0, CW / 2, CH / 2);
  lbx.save(); lbx.filter = 'blur(1.5px)'; lbx.translate(0, CH / 2); lbx.rotate(-Math.PI / 2); drawBrand(lbx, 'p01', 150, 190, 750, '#c4c4c4'); lbx.restore();
  const lidTop = new THREE.MeshStandardMaterial({ map: tex(lc), bumpMap: tex(lb, false), bumpScale: 5, roughness: 0.85 });
  const paper = new THREE.MeshStandardMaterial({ color: '#d6cdb8', roughness: 0.95 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, Hb, L - 0.04), paper);
  base.position.y = Hb / 2; spin.add(base);

  // pasta Mata com foil dourado (dentro da caixa)
  const [fc, fx] = canvas(1000, 1300); const [fm, fmx] = canvas(1000, 1300); const [fr, frx] = canvas(1000, 1300);
  fx.fillStyle = HEX.mata; fx.fillRect(0, 0, 1000, 1300); noise(fx, 1000, 1300, 8);
  fmx.fillStyle = '#000'; fmx.fillRect(0, 0, 1000, 1300); frx.fillStyle = '#d0d0d0'; frx.fillRect(0, 0, 1000, 1300);
  const gl = goldCss(fx, 200, 200, 800, 900);
  drawBrand(fx, 'vertical', 500, 420, 520, gl); drawBrand(fmx, 'vertical', 500, 420, 520, '#fff'); drawBrand(frx, 'vertical', 500, 420, 520, '#555');
  fx.fillStyle = HEX.douradoClaro; fx.fillRect(450, 690, 100, 3);
  drawEndorseCentered(fx, 500, 760, 340, gl); drawEndorseCentered(fmx, 500, 760, 340, '#fff'); drawEndorseCentered(frx, 500, 760, 340, '#555');
  const folderMat = new THREE.MeshPhysicalMaterial({ map: tex(fc), metalnessMap: tex(fm, false), roughnessMap: tex(fr, false), metalness: 1, roughness: 1 });
  const folderEdge = new THREE.MeshStandardMaterial({ color: HEX.mata, roughness: 0.8 });
  const folder = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.05, L - 0.6), [folderEdge, folderEdge, folderMat, folderEdge, folderEdge, folderEdge]);
  folder.position.y = Hb + 0.03; spin.add(folder);

  const lid = new THREE.Group(); lid.position.y = Hb + lidH / 2 + 0.06; spin.add(lid);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(W, lidH, L), [paper, paper, lidTop, paper, paper, paper]);
  lid.add(lidMesh);

  let open = false;
  return {
    group, spin, freeSpin: false, limitSpin: 1.2, rest: { x: 0.85, y: -0.35 }, groundY: -0.9,
    cam: { pos: { x: 0, y: 1.6, z: 9.5 }, target: { x: 0, y: -0.2, z: 0 } },
    reset() { open = false; lid.position.set(0, Hb + lidH / 2 + 0.06, 0); lid.rotation.set(0, 0, 0); },
    click() {
      open = !open;
      const g = window.gsap;
      g.to(lid.position, { y: open ? 1.6 : Hb + lidH / 2 + 0.06, x: open ? 2.4 : 0, z: open ? -0.6 : 0, duration: 1.4, ease: 'expo.inOut' });
      g.to(lid.rotation, { z: open ? -0.35 : 0, y: open ? 0.25 : 0, duration: 1.4, ease: 'expo.inOut' });
    },
  };
}
function drawEndorseCentered(ctx, cx, y, w, color) {
  ctx.save(); ctx.fillStyle = color;
  ctx.font = `500 ${Math.round(w * 0.075)}px "DM Sans", Arial`;
  spaced(ctx, 'UM EMPREENDIMENTO', cx, y, w * 0.02);
  drawBrand(ctx, 'avra', cx, y + w * 0.14, w * 0.5, color);
  ctx.font = `500 ${Math.round(w * 0.055)}px Manrope, "DM Sans", Arial`;
  spaced(ctx, 'INCORPORADORA', cx, y + w * 0.3, w * 0.035);
  ctx.restore();
}

/* =================================================================
   2 · CADERNO
================================================================= */
function makeNotebook() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  const W = 2.2; const Hh = 3.0; const T = 0.05; const P = 0.3;

  // capa: couro Mata com o símbolo em foil dourado
  const [cc, cx] = canvas(1100, 1500); const [cm, cmx] = canvas(1100, 1500); const [cr, crx] = canvas(1100, 1500);
  cx.fillStyle = '#1d4234'; cx.fillRect(0, 0, 1100, 1500);
  for (let i = 0; i < 9000; i++) { cx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '120,160,130'},${Math.random() * 0.08})`; cx.fillRect(Math.random() * 1100, Math.random() * 1500, 2, 2); }
  noise(cx, 1100, 1500, 8);
  cmx.fillStyle = '#000'; cmx.fillRect(0, 0, 1100, 1500); crx.fillStyle = '#b0b0b0'; crx.fillRect(0, 0, 1100, 1500);
  const foil = goldCss(cx, 330, 450, 770, 900);
  drawBrand(cx, 'symbol', 550, 680, 440, foil); drawBrand(cmx, 'symbol', 550, 680, 440, '#fff'); drawBrand(crx, 'symbol', 550, 680, 440, '#444');
  const [bc, bx] = canvas(550, 750); bx.drawImage(cc, 0, 0, 550, 750);
  const coverTex = tex(cc);
  // guarda (verso da capa) com P01
  const [gc, gx] = canvas(1100, 1500);
  gx.fillStyle = '#eee9dc'; gx.fillRect(0, 0, 1100, 1500); noise(gx, 1100, 1500, 6);
  gx.save(); gx.translate(1100, 0); gx.rotate(Math.PI / 2); drawBrand(gx, 'p01', 900, 300, 2200, HEX.salvia); gx.restore();

  const plain = new THREE.MeshStandardMaterial({ color: '#1d4234', roughness: 0.7 });
  const coverMat = new THREE.MeshPhysicalMaterial({ map: coverTex, bumpMap: tex(bc, false), bumpScale: 1.2, metalnessMap: tex(cm, false), roughnessMap: tex(cr, false), metalness: 1, roughness: 1, clearcoat: 0.15 });
  const guardMat = new THREE.MeshStandardMaterial({ map: tex(gc), roughness: 0.9 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, T), plain);
  back.position.z = -P / 2 - T / 2; spin.add(back);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(T, Hh, P + 2 * T), plain);
  spine.position.x = -W / 2 + T / 2; spin.add(spine);

  // bloco de páginas
  const [pc, px] = canvas(64, 512);
  px.fillStyle = '#f2eee4'; px.fillRect(0, 0, 64, 512);
  for (let x = 0; x < 64; x += 2) { px.fillStyle = `rgba(120,110,90,${0.08 + Math.random() * 0.08})`; px.fillRect(x, 0, 1, 512); }
  const edgeMat = new THREE.MeshStandardMaterial({ map: tex(pc), roughness: 0.9 });
  const pageW = W - 0.12;
  const [fc, fx] = canvas(1050, 1450);
  fx.fillStyle = '#f4f0e6'; fx.fillRect(0, 0, 1050, 1450); noise(fx, 1050, 1450, 5);
  fx.fillStyle = HEX.mata; fx.font = '400 92px Marcellus, Georgia'; fx.textAlign = 'left';
  fx.fillText('Espaço para', 110, 330); fx.fillText('a vida em família.', 110, 440);
  fx.fillStyle = HEX.dourado; fx.fillRect(112, 510, 120, 3);
  fx.save(); fx.translate(0, 1450); fx.rotate(-Math.PI / 2); drawBrand(fx, 'p01', 250, 900, 1300, HEX.salvia); fx.restore();
  fx.fillStyle = HEX.oliva; fx.font = '400 30px "DM Sans", Arial'; fx.fillText('Alta Vista Residence', 110, 600);
  const pageTop = new THREE.MeshStandardMaterial({ map: tex(fc), roughness: 0.95 });
  const pages = new THREE.Mesh(new THREE.BoxGeometry(pageW, Hh - 0.08, P), [edgeMat, edgeMat, edgeMat, edgeMat, pageTop, edgeMat]);
  pages.position.x = 0.02; spin.add(pages);

  // capa frontal articulada na lombada
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, P / 2 + T / 2); spin.add(hinge);
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, T), [plain, plain, plain, plain, coverMat, guardMat]);
  front.position.x = W / 2; hinge.add(front);

  // elástico vertical
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, Hh + 0.02, P + 2 * T + 0.03), new THREE.MeshStandardMaterial({ color: '#12301f', roughness: 0.6 }));
  band.position.set(W / 2 - 0.32, 0, 0); spin.add(band);
  // fita marcadora
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.9), new THREE.MeshStandardMaterial({ color: HEX.oliva, roughness: 0.5, side: THREE.DoubleSide }));
  ribbon.position.set(0.55, -Hh / 2 - 0.3, 0.05); ribbon.rotation.z = 0.06; spin.add(ribbon);

  let open = false;
  return {
    group, spin, freeSpin: true, rest: { x: 0.1, y: 0.35 }, groundY: -1.62,
    cam: { pos: { x: 0, y: 0.5, z: 9 }, target: { x: 0.3, y: 0, z: 0 } },
    reset() { open = false; hinge.rotation.y = 0; band.position.x = W / 2 - 0.32; },
    click() {
      open = !open;
      window.gsap.to(band.position, { x: open ? W / 2 + 0.2 : W / 2 - 0.32, duration: 0.5, ease: 'power2.out' });
      window.gsap.to(hinge.rotation, { y: open ? -2.5 : 0, duration: 1.6, delay: open ? 0.25 : 0, ease: 'expo.inOut' });
    },
    update(dt, t) { ribbon.rotation.z = 0.06 + Math.sin(t * 1.3) * 0.04; },
  };
}

/* =================================================================
   3 · CRACHÁ
================================================================= */
function makeBadge() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  const pivot = new THREE.Group(); pivot.position.y = 3.2; spin.add(pivot);
  const W = 1.8; const H = 2.5; const r = 0.12; const D = 0.012;

  const rr = (w, h, rad) => {
    const s = new THREE.Shape(); const x = -w / 2; const y = -h / 2;
    s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad);
    s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad);
    s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
    return s;
  };
  const shape = rr(W, H, r);
  const hole = new THREE.Path(); hole.absarc(0, H / 2 - 0.16, 0.05, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
  const uv = geo.attributes.uv; const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);

  const CW = 900; const CH = 1250;
  // frente: Mata com foil dourado e endosso AVRA
  const [fc, fx] = canvas(CW, CH); const [mc, mx] = canvas(CW, CH); const [rc, rx] = canvas(CW, CH);
  fx.fillStyle = HEX.mata; fx.fillRect(0, 0, CW, CH); noise(fx, CW, CH, 8);
  mx.fillStyle = '#000'; mx.fillRect(0, 0, CW, CH);
  rx.fillStyle = '#c8c8c8'; rx.fillRect(0, 0, CW, CH);
  const gl = goldCss(fx, 200, 200, 700, 700);
  drawBrand(fx, 'vertical', CW / 2, 420, 560, gl); drawBrand(mx, 'vertical', CW / 2, 420, 560, '#fff'); drawBrand(rx, 'vertical', CW / 2, 420, 560, '#555');
  fx.fillStyle = HEX.douradoClaro; fx.fillRect(CW / 2 - 50, 700, 100, 3); mx.fillStyle = '#fff'; mx.fillRect(CW / 2 - 50, 700, 100, 3);
  drawEndorseCentered(fx, CW / 2, 800, 440, HEX.mineral);
  const frontMat = new THREE.MeshPhysicalMaterial({ map: tex(fc), metalnessMap: tex(mc, false), roughnessMap: tex(rc, false), metalness: 1, roughness: 1, sheen: 0.3 });
  // verso: P01 discreto
  const [bc, bx] = canvas(CW, CH);
  bx.fillStyle = HEX.mata; bx.fillRect(0, 0, CW, CH); noise(bx, CW, CH, 8);
  bx.save(); bx.translate(CW, 0); bx.rotate(Math.PI / 2); drawBrand(bx, 'p01', 700, 260, 1800, 'rgba(160,173,145,0.55)'); bx.restore();
  const backMat = new THREE.MeshStandardMaterial({ map: tex(bc), roughness: 0.9 });

  const card = new THREE.Group(); card.position.y = -3.2 - 0.35;
  const f = new THREE.Mesh(geo, frontMat); card.add(f);
  const b = new THREE.Mesh(geo, backMat); b.rotation.y = Math.PI; card.add(b);
  pivot.add(card);

  // mosquetão + fita
  const metal = brushedGold(0.3);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 12, 40), metal);
  ring.position.set(0, -3.2 + 0.98 - 0.35 + 0.05, 0); ring.rotation.y = Math.PI / 2; pivot.add(ring);
  const clip = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 6, 16), metal);
  clip.position.set(0, ring.position.y + 0.22, 0); pivot.add(clip);
  const [lc, lx] = canvas(64, 512);
  lx.fillStyle = '#3f4a2c'; lx.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 4) { lx.fillStyle = `rgba(160,173,145,${0.08 + Math.random() * 0.06})`; lx.fillRect(0, y, 64, 2); }
  const lt = tex(lc); lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.repeat.set(1, 6);
  const strapMat = new THREE.MeshStandardMaterial({ map: lt, roughness: 0.8, side: THREE.DoubleSide });
  const topY = clip.position.y + 0.12;
  [-1, 1].forEach((sgn) => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, topY, 0), new THREE.Vector3(sgn * 0.12, topY + 0.6, 0.02), new THREE.Vector3(sgn * 0.42, topY + 2.4, -0.1), new THREE.Vector3(sgn * 0.7, topY + 5, -0.3)]);
    const strap = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.05, 6, false), strapMat);
    strap.scale.z = 0.25;
    pivot.add(strap);
  });

  const phys = { a: 0.25, va: 0, tw: 0, vtw: 0 };
  return {
    group, spin, rest: { x: 0, y: 0 }, groundY: null,
    cam: { pos: { x: 0, y: 0.1, z: 7.5 }, target: { x: 0, y: -0.25, z: 0 } },
    reset() { phys.a = 0.35; phys.va = 0; phys.tw = 0; phys.vtw = 0; pivot.rotation.set(0, 0, 0); },
    onDrag(dx) { phys.va += dx * 0.0025; phys.vtw += dx * 0.004; },
    click() { phys.vtw += 0.6; phys.va += (Math.random() - 0.5) * 0.4; },
    update(dt, t) {
      phys.va += (-phys.a * 3.2) * dt; phys.va *= 1 - 0.9 * dt; phys.a += phys.va * dt * 2.2;
      phys.vtw += (-Math.sin(phys.tw) * 2.6) * dt; phys.vtw *= 1 - 1.1 * dt; phys.tw += phys.vtw * dt * 3;
      pivot.rotation.z = phys.a + Math.sin(t * 0.9) * 0.015;
      pivot.rotation.y = phys.tw + Math.sin(t * 0.6) * 0.1;
    },
  };
}

/* =================================================================
   CHAVEIRO
================================================================= */
function makeKeychain() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  const gold = new THREE.MeshPhysicalMaterial({ color: '#c3a465', metalness: 1, roughness: 0.22, clearcoat: 0.3, clearcoatRoughness: 0.2 });
  const sym = new THREE.Group();
  PATHS.symbol.forEach((d) => shapesOf(d).forEach((sh) => {
    sym.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 26, bevelEnabled: true, bevelThickness: 4, bevelSize: 2.5, bevelSegments: 5, curveSegments: 32 }), gold));
  }));
  const k = 0.0066; sym.scale.set(k, -k, k);
  sym.position.set(-639.5 * k, 337.5 * k - 0.4, -13 * k);
  spin.add(sym);
  // argola e elo
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 24, 96), gold);
  ring.position.set(0.05, 1.3, 0); ring.rotation.y = 0.5; spin.add(ring);
  const link = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 16, 48), gold);
  link.position.set(0.02, 0.8, 0); link.rotation.y = Math.PI / 2; spin.add(link);

  const phys = { v: 0 };
  return {
    group, spin, freeSpin: true, rest: { x: 0.05, y: 0 }, groundY: -1.9,
    cam: { pos: { x: 0, y: 0.3, z: 9.5 }, target: { x: 0, y: 0.2, z: 0 } },
    reset() { phys.v = 0; spin.position.y = 0; },
    click() {
      phys.v = 0.4;
      window.gsap.timeline().to(spin.position, { y: 1.1, duration: 0.45, ease: 'power2.out' }).to(spin.position, { y: 0, duration: 0.7, ease: 'bounce.out' });
    },
    update(dt, t) {
      spin.rotation.y += phys.v; phys.v *= 0.95;
      sym.rotation.z = Math.sin(t * 1.1) * 0.03;
    },
  };
}
