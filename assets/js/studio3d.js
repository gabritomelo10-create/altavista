import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VERTICAL, P01 } from './brand-paths.js';

const HEX = { mata: '#193C30', floresta: '#284B3B', oliva: '#667451', salvia: '#A0AD91', dourado: '#B79A58', douradoClaro: '#D7C18C', mineral: '#E8E3D5' };
const VB = { vertical: [330, 178, 620, 480], symbol: [462, 181, 355, 313], p01: [486, 210, 794, 400] };
const PATHS = {
  vertical: [VERTICAL.symbol, VERTICAL.lettering, VERTICAL.residence],
  symbol: [VERTICAL.symbol],
  p01: [P01.d],
};

const CAPTIONS = [
  ['Pavilhão de vendas', 'Símbolo e lettering em relevo dourado escovado, com luz de fundo sobre parede mineral. Clique para acender o halo.'],
  ['Garrafa térmica', 'Pintura Mata com o símbolo em dourado, tampa metálica. Clique para abrir a tampa.'],
  ['Caderno de boas-vindas', 'Capa em tecido Sálvia com assinatura Mata e guarda com o P01. Clique para abrir.'],
  ['Crachá', 'Oliva com assinatura em foil dourado; P01 discreto no verso. Arraste para balançar, clique para girar.'],
  ['Convite', 'Papel mineral com baixo-relevo do P01 e envelope Sálvia. Clique para aproximar.'],
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

  const items = [makeSign(), makeBottle(), makeNotebook(), makeBadge(), makeInvite()];
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

  // halo de luz atrás das letras (retroiluminação)
  const [hc, hx] = canvas(1240, 960);
  hx.filter = 'blur(28px)';
  drawBrand(hx, 'vertical', 620, 480, 1000, 'rgba(255,226,160,0.95)');
  hx.filter = 'blur(8px)';
  drawBrand(hx, 'vertical', 620, 480, 980, 'rgba(255,236,190,0.7)');
  const haloMat = new THREE.MeshBasicMaterial({ map: tex(hc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.8), haloMat);
  halo.position.set(0, 0.25, -0.135); spin.add(halo);

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

  const spot = new THREE.SpotLight(0xffe9c4, 60, 12, 0.55, 0.6, 1.4);
  spot.position.set(0, 4.2, 2.6); spot.target.position.set(0, 0.3, -0.2);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
  spin.add(spot, spot.target);

  let lit = false;
  const it = {
    group, spin, limitSpin: 0.7, rest: { x: 0, y: -0.18 }, groundY: null, shift: 2.0,
    cam: { pos: { x: 0, y: 0.3, z: 10.5 }, target: { x: 0, y: 0.1, z: 0 } },
    reset() { lit = true; haloMat.opacity = 0; window.gsap.to(haloMat, { opacity: 0.5, duration: 2.4, delay: 1, ease: 'power2.inOut' }); },
    click() { lit = !lit; window.gsap.to(haloMat, { opacity: lit ? 0.5 : 0, duration: 1.2, ease: 'power2.inOut' }); window.gsap.to(spot, { intensity: lit ? 60 : 110, duration: 1.2 }); },
    update(dt, t) { spot.position.x = Math.sin(t * 0.5) * 1.2; },
  };
  return it;
}

/* =================================================================
   1 · GARRAFA TÉRMICA
================================================================= */
function makeBottle() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  group.position.y = -1.35;

  const R = 0.62;
  const prof = [];
  const add = (r, y) => prof.push(new THREE.Vector2(r, y));
  add(0.001, 0); add(R - 0.06, 0); add(R - 0.01, 0.03); add(R, 0.1);
  for (let i = 1; i <= 16; i++) add(R, 0.1 + (i / 16) * 1.85);
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); add(0.45 + (R - 0.45) * Math.cos(a), 1.95 + Math.sin(a) * 0.32); }
  add(0.44, 2.36);
  const body = new THREE.LatheGeometry(prof, 128);

  // UVs da Lathe: u = ângulo, v = índice do ponto → posicionamos o símbolo pela altura
  const W = 2048; const H = 1024;
  const [cc, cx] = canvas(W, H); const [mc, mx] = canvas(W, H); const [rc, rx] = canvas(W, H);
  cx.fillStyle = HEX.mata; cx.fillRect(0, 0, W, H); noise(cx, W, H, 6);
  mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
  rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, W, H); noise(rx, W, H, 30);
  const vOf = (y) => { // y em unidades → v (0 embaixo)
    let best = 0;
    prof.forEach((p, i) => { if (Math.abs(p.y - y) < Math.abs(prof[best].y - y)) best = i; });
    return best / (prof.length - 1);
  };
  const vC = vOf(1.15);
  const symW = 0.78; const pxPerU = W / (2 * Math.PI * R);
  const pxPerUV = H * ((vOf(1.6) - vOf(0.7)) / 0.9); // px por unidade na altura do corpo
  const sw = symW * pxPerU; const sy = pxPerUV / pxPerU;
  const ccx = W * 0.5; const ccy = H * (1 - vC);
  drawBrand(cx, 'symbol', ccx, ccy, sw, goldCss(cx, ccx - sw / 2, ccy - sw / 2, ccx + sw / 2, ccy + sw / 2), { sy });
  drawBrand(mx, 'symbol', ccx, ccy, sw, '#fff', { sy });
  drawBrand(rx, 'symbol', ccx, ccy, sw, '#4a4a4a', { sy });
  const bodyMat = new THREE.MeshPhysicalMaterial({ map: tex(cc), metalnessMap: tex(mc, false), roughnessMap: tex(rc, false), metalness: 1, roughness: 1, clearcoat: 0.15, clearcoatRoughness: 0.6 });
  const bottle = new THREE.Mesh(body, bodyMat);
  bottle.rotation.y = Math.PI; // símbolo voltado para a câmera
  spin.add(bottle);

  // tampa dourada
  const cap = new THREE.Group();
  const capBody = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.42, 96, 1), brushedGold(0.3));
  const capTop = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 16, 96), brushedGold(0.25));
  capTop.rotation.x = Math.PI / 2; capTop.position.y = 0.21;
  const capLid = new THREE.Mesh(new THREE.CircleGeometry(0.44, 96), brushedGold(0.22));
  capLid.rotation.x = -Math.PI / 2; capLid.position.y = 0.245;
  cap.add(capBody, capTop, capLid);
  cap.position.y = 2.36 + 0.2;
  spin.add(cap);
  const neckRing = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.06, 64), new THREE.MeshStandardMaterial({ color: HEX.floresta, roughness: 0.5 }));
  neckRing.position.y = 2.34; spin.add(neckRing);

  let open = false;
  return {
    group, spin, freeSpin: true, rest: { x: 0.12, y: 0 }, groundY: -1.35,
    cam: { pos: { x: 0, y: 0.6, z: 8.2 }, target: { x: 0, y: -0.1, z: 0 } },
    reset() { open = false; cap.position.y = 2.56; cap.rotation.y = 0; },
    click() {
      open = !open;
      window.gsap.to(cap.position, { y: open ? 3.25 : 2.56, duration: 1.4, ease: open ? 'power3.out' : 'power3.inOut' });
      window.gsap.to(cap.rotation, { y: open ? -Math.PI * 3 : 0, z: open ? 0.25 : 0, duration: 1.4, ease: 'power3.inOut' });
    },
    update(dt, t) { if (open) cap.position.x = Math.sin(t * 1.2) * 0.03; },
  };
}

/* =================================================================
   2 · CADERNO
================================================================= */
function makeNotebook() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);
  const W = 2.2; const Hh = 3.0; const T = 0.05; const P = 0.3;

  // capa
  const [cc, cx] = canvas(1100, 1500);
  cx.fillStyle = HEX.salvia; cx.fillRect(0, 0, 1100, 1500);
  for (let y = 0; y < 1500; y += 3) { cx.fillStyle = `rgba(25,60,48,${Math.random() * 0.05})`; cx.fillRect(0, y, 1100, 1); }
  for (let x = 0; x < 1100; x += 3) { cx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; cx.fillRect(x, 0, 1, 1500); }
  noise(cx, 1100, 1500, 10);
  drawBrand(cx, 'vertical', 550, 560, 640, HEX.mata);
  cx.fillStyle = HEX.dourado; cx.fillRect(500, 900, 100, 3);
  cx.fillStyle = HEX.mata; cx.font = '400 40px "DM Sans", Arial'; cx.textAlign = 'left';
  spaced(cx, 'Nossos próximos capítulos', 550, 990, 4);
  const [bc, bx] = canvas(550, 750); bx.drawImage(cc, 0, 0, 550, 750);
  const coverTex = tex(cc);

  // guarda (verso da capa) com P01
  const [gc, gx] = canvas(1100, 1500);
  gx.fillStyle = '#eee9dc'; gx.fillRect(0, 0, 1100, 1500); noise(gx, 1100, 1500, 6);
  gx.save(); gx.translate(1100, 0); gx.rotate(Math.PI / 2); drawBrand(gx, 'p01', 900, 300, 2200, HEX.salvia); gx.restore();

  const plain = new THREE.MeshStandardMaterial({ color: HEX.salvia, roughness: 0.85 });
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, bumpMap: tex(bc, false), bumpScale: 1.2, roughness: 0.85 });
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

  // fita marcadora
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.9), new THREE.MeshStandardMaterial({ color: HEX.mata, roughness: 0.5, side: THREE.DoubleSide }));
  ribbon.position.set(0.55, -Hh / 2 - 0.3, 0.05); ribbon.rotation.z = 0.06; spin.add(ribbon);

  let open = false;
  return {
    group, spin, freeSpin: true, rest: { x: 0.1, y: 0.35 }, groundY: -1.62,
    cam: { pos: { x: 0, y: 0.5, z: 9 }, target: { x: 0.3, y: 0, z: 0 } },
    reset() { open = false; hinge.rotation.y = 0; },
    click() { open = !open; window.gsap.to(hinge.rotation, { y: open ? -2.5 : 0, duration: 1.6, ease: 'expo.inOut' }); },
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
  // frente: Oliva com foil dourado
  const [fc, fx] = canvas(CW, CH); const [mc, mx] = canvas(CW, CH); const [rc, rx] = canvas(CW, CH);
  fx.fillStyle = HEX.oliva; fx.fillRect(0, 0, CW, CH); noise(fx, CW, CH, 8);
  mx.fillStyle = '#000'; mx.fillRect(0, 0, CW, CH);
  rx.fillStyle = '#c8c8c8'; rx.fillRect(0, 0, CW, CH);
  const gl = goldCss(fx, 200, 300, 700, 800);
  drawBrand(fx, 'vertical', CW / 2, 520, 560, gl); drawBrand(mx, 'vertical', CW / 2, 520, 560, '#fff'); drawBrand(rx, 'vertical', CW / 2, 520, 560, '#555');
  fx.fillStyle = HEX.douradoClaro; fx.fillRect(CW / 2 - 50, 790, 100, 3); mx.fillStyle = '#fff'; mx.fillRect(CW / 2 - 50, 790, 100, 3);
  fx.textAlign = 'center'; fx.fillStyle = HEX.mineral; fx.font = '600 50px "DM Sans", Arial'; fx.fillText('Nome do Colaborador', CW / 2, 900);
  fx.fillStyle = HEX.salvia; fx.font = '400 34px "DM Sans", Arial'; fx.fillText('Função', CW / 2, 960);
  const frontMat = new THREE.MeshPhysicalMaterial({ map: tex(fc), metalnessMap: tex(mc, false), roughnessMap: tex(rc, false), metalness: 1, roughness: 1, sheen: 0.3 });
  // verso: P01 discreto
  const [bc, bx] = canvas(CW, CH);
  bx.fillStyle = HEX.oliva; bx.fillRect(0, 0, CW, CH); noise(bx, CW, CH, 8);
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
  lx.fillStyle = HEX.mata; lx.fillRect(0, 0, 64, 512);
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
   4 · CONVITE
================================================================= */
function makeInvite() {
  const group = new THREE.Group(); const spin = new THREE.Group(); group.add(spin);

  // envelope Sálvia com P01 em baixo-relevo
  const [ec, ex] = canvas(1040, 1360); const [ebc, ebx] = canvas(520, 680);
  ex.fillStyle = HEX.salvia; ex.fillRect(0, 0, 1040, 1360); noise(ex, 1040, 1360, 10);
  ebx.fillStyle = '#808080'; ebx.fillRect(0, 0, 520, 680);
  ebx.save(); ebx.filter = 'blur(2px)'; ebx.translate(0, 680); ebx.rotate(-Math.PI / 2); drawBrand(ebx, 'p01', 160, 380, 900, '#b0b0b0'); ebx.restore();
  const envMat = new THREE.MeshStandardMaterial({ map: tex(ec), bumpMap: tex(ebc, false), bumpScale: 6, roughness: 0.9 });
  const env = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 0.03), [envMat, envMat, envMat, envMat, envMat, envMat]);
  env.position.set(-0.45, 0.05, -0.06); env.rotation.z = 0.05; spin.add(env);

  // cartão mineral
  const CW = 1100; const CH = 1500;
  const [cc, cx] = canvas(CW, CH); const [bc, bx] = canvas(CW / 2, CH / 2);
  cx.fillStyle = '#efebe1'; cx.fillRect(0, 0, CW, CH); noise(cx, CW, CH, 6);
  drawBrand(cx, 'vertical', CW / 2, 380, 520, HEX.mata);
  cx.fillStyle = HEX.dourado; cx.fillRect(CW / 2 - 70, 640, 140, 3);
  cx.fillStyle = HEX.mata; cx.textAlign = 'center'; cx.font = '400 72px Marcellus, Georgia';
  cx.fillText('Um convite para', CW / 2, 790); cx.fillText('imaginar novos dias.', CW / 2, 880);
  cx.font = '400 34px "DM Sans", Arial'; cx.fillStyle = HEX.floresta; cx.fillText('Conheça o Alta Vista Residence.', CW / 2, 965);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, CW / 2, CH / 2);
  bx.save(); bx.filter = 'blur(1.5px)'; bx.translate(0, CH / 2); bx.rotate(-Math.PI / 2); drawBrand(bx, 'p01', 70, 330, 760, '#c8c8c8'); bx.restore();
  // leve sombreamento do relevo na cor
  cx.save(); cx.globalAlpha = 0.05; cx.translate(0, CH); cx.rotate(-Math.PI / 2); drawBrand(cx, 'p01', 140, 660, 1520, '#7a7464'); cx.restore();
  const cardMat = new THREE.MeshStandardMaterial({ map: tex(cc), bumpMap: tex(bc, false), bumpScale: 5, roughness: 0.82 });
  const edge = new THREE.MeshStandardMaterial({ color: '#efebe1', roughness: 0.9 });
  const card = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.0, 0.02), [edge, edge, edge, edge, cardMat, edge]);
  card.position.set(0.35, -0.05, 0.03); card.rotation.z = -0.03;
  spin.add(card);

  // fita oliva
  const [rc, rx] = canvas(64, 512);
  rx.fillStyle = HEX.oliva; rx.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 64; i += 2) { rx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; rx.fillRect(i, 0, 1, 512); }
  const ribbonMat = new THREE.MeshPhysicalMaterial({ map: tex(rc), roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color(HEX.douradoClaro), sheenRoughness: 0.4 });
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.7, 0.02), ribbonMat);
  ribbon.position.set(-0.95, 0, 0.065); ribbon.rotation.z = 0.04; spin.add(ribbon);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), ribbonMat);
  knot.scale.set(1.1, 0.8, 0.35); knot.position.set(-0.95, 0.15, 0.1); spin.add(knot);
  [-1, 1].forEach((sgn) => {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 30, Math.PI * 1.4), ribbonMat);
    loop.scale.set(1.2, 0.8, 0.4); loop.position.set(-0.95 + sgn * 0.26, 0.17, 0.1); loop.rotation.z = sgn > 0 ? -0.9 : Math.PI - 0.6 + 0.9;
    spin.add(loop);
  });

  let near = false;
  return {
    group, spin, freeSpin: false, limitSpin: 0.9, rest: { x: -0.5, y: 0.2 }, groundY: -1.95,
    cam: { pos: { x: 0, y: 1.4, z: 8.4 }, target: { x: 0, y: -0.1, z: 0 } },
    reset() { near = false; card.position.set(0.35, -0.05, 0.03); card.rotation.set(0, 0, -0.03); },
    click() {
      near = !near;
      window.gsap.to(card.position, { x: near ? 0.15 : 0.35, y: near ? 0.25 : -0.05, z: near ? 1.6 : 0.03, duration: 1.4, ease: 'expo.inOut' });
      window.gsap.to(card.rotation, { x: near ? 0.42 : 0, y: near ? -0.15 : 0, z: near ? 0 : -0.03, duration: 1.4, ease: 'expo.inOut' });
    },
  };
}
