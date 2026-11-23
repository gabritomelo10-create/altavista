import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDenture } from './dentes.js';

const $ = (s) => document.querySelector(s);
const ui = {
  intro: $('#intro'), hud: $('#hud'), scan: $('#scan'), stage: $('#stage'), msg: $('#msg'),
  count: $('#count'), bar: $('#bar'), exit: $('#btn-exit'), hint: $('#hint'),
  pause: $('#btn-pause'), reset: $('#btn-reset'), mouth: $('#btn-mouth'), sep: $('#btn-sep'),
  pin: $('#btn-pin'), center: $('#btn-center'),
  startAR: $('#btn-ar'), start3D: $('#btn-3d'), secure: $('#secure-warning'),
  loading: $('#loading'), loadStep: $('#load-step'), loadBar: $('#load-bar'),
  label: $('#label'), labelName: $('#label-name'), labelInfo: $('#label-info'),
};
const T0 = performance.now();
const mark = (name) => console.debug(`[ar] ${name}: ${Math.round(performance.now() - T0)} ms`);

if (!window.isSecureContext) ui.secure.hidden = false;

/* ---------- pré-carregamento: rastreador + marcador baixam enquanto a pessoa lê a abertura ---------- */
let arModule = null, targetUrl = null;
function preloadAR() {
  arModule ??= import('./vendor/mindar/mindar-image-three.prod.js').then(async (m) => {
    mark('mindar importado');
    // inicializa o TensorFlow (WebGL) antes do clique
    try { await window.MINDAR?.IMAGE?.tf?.ready?.(); mark('tf pronto'); } catch { /* segue */ }
    return m;
  });
  targetUrl ??= fetch('./assets/marcador.mind')
    .then((r) => { if (!r.ok) throw new Error('marcador.mind ' + r.status); return r.blob(); })
    .then((b) => { mark('marcador baixado'); return URL.createObjectURL(b); });
  arModule.catch(() => { arModule = null; });
  targetUrl.catch(() => { targetUrl = null; });
  return Promise.all([arModule, targetUrl]);
}
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 400));
addEventListener('load', () => idle(() => preloadAR().catch(() => {})));
ui.startAR.addEventListener('pointerdown', () => preloadAR().catch(() => {}), { once: true });

/* ---------- cena: âncora > content > pan > lift > tilt > yaw > dentadura ---------- */
// Espaço do marcador (igual ao do MindAR): x para a direita, y para cima na imagem,
// z saindo do papel. 1 unidade = largura da imagem impressa.
const MODEL_SCALE = 0.125;
const PIVOT_Y = 0.45; // centro da dentadura (unidades do modelo), ponto em que ela gira

const denture = createDenture({
  onProgress(done, total) {
    ui.count.textContent = `${done}/${total}`;
    ui.bar.style.transform = `scaleX(${done / total})`;
    if (done === total) toast('Tudo limpo! ✨ A sujeira volta em instantes.');
  },
});

const content = new THREE.Group();
const pan = new THREE.Group();
const lift = new THREE.Group();
const tilt = new THREE.Group();
const yaw = new THREE.Group();
lift.rotation.x = Math.PI / 2;
tilt.position.y = PIVOT_Y;
yaw.position.y = -PIVOT_Y;
content.add(pan); pan.add(lift); lift.add(tilt); tilt.add(yaw); yaw.add(denture.root);

const view = { yaw: 0, tilt: 0, scale: 1, yawT: 0, tiltT: 0, scaleT: 1 };
function resetView() {
  Object.assign(view, { yawT: 0, tiltT: 0, scaleT: 1 });
  pan.position.set(0, 0, 0);
}
function applyView(dt) {
  const f = 1 - Math.exp(-dt * 14);
  view.yaw += (view.yawT - view.yaw) * f;
  view.tilt += (view.tiltT - view.tilt) * f;
  view.scale += (view.scaleT - view.scale) * f;
  yaw.rotation.y = view.yaw;
  tilt.rotation.x = view.tilt;
  const s = MODEL_SCALE * view.scale;
  lift.scale.setScalar(s);
  lift.position.z = 1.0 * s;
}

// sombra suave no papel
const shadow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.85), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.position.z = 0.002;
  return m;
})();
pan.add(shadow);

function addLights(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#ffffff', '#88606a', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(0.6, -0.8, 1.6);
  scene.add(key);
}

/* ---------- etiqueta do dente selecionado ---------- */
const tmpV = new THREE.Vector3();
function updateLabel(camera, dom) {
  const t = denture.selected;
  if (!t || !t.visible) { ui.label.hidden = true; return; }
  t.updateWorldMatrix(true, false);
  tmpV.set(0, 0.5, 0).applyMatrix4(t.matrixWorld).project(camera);
  if (tmpV.z > 1) { ui.label.hidden = true; return; }
  const r = dom.getBoundingClientRect();
  ui.label.hidden = false;
  const half = ui.label.firstElementChild.offsetWidth / 2 + 8;
  const x = THREE.MathUtils.clamp(((tmpV.x + 1) / 2) * r.width, half, r.width - half);
  const y = Math.max(((1 - tmpV.y) / 2) * r.height, 120);
  ui.label.style.transform = `translate(${x}px, ${y}px)`;
}
function showTooth(mesh) {
  if (!mesh) { ui.label.hidden = true; return; }
  ui.labelName.textContent = mesh.userData.name;
  ui.labelInfo.textContent = mesh.userData.info;
}

/* ---------- gestos ---------- */
// 1 dedo: gira (para os lados e para cima/baixo) · 2 dedos: pinça aproxima e arrastar move
// toque: escolhe dente / vão · toque duplo: volta à vista inicial
function bindGestures(dom, camera, { ar }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pts = new Map();
  let one = null, two = null, lastTap = 0;
  const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };

  dom.addEventListener('pointerdown', (e) => {
    dom.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) one = { x: e.clientX, y: e.clientY, t: e.timeStamp, yaw: view.yawT, tilt: view.tiltT, moved: false };
    if (pts.size === 2 && ar) { const m = mid(); two = { ...m, scale: view.scaleT, pan: pan.position.clone() }; if (one) one.moved = true; }
  });
  dom.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (two && pts.size === 2) {
      const m = mid();
      view.scaleT = THREE.MathUtils.clamp(two.scale * (m.d / two.d), 0.4, 4);
      movePan(two.pan, m.x - two.x, m.y - two.y);
      return;
    }
    if (!one || pts.size !== 1) return;
    const dx = e.clientX - one.x, dy = e.clientY - one.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) one.moved = true;
    if (ar && one.moved) {
      view.yawT = one.yaw + dx * 0.011;
      view.tiltT = THREE.MathUtils.clamp(one.tilt + dy * 0.009, -1.35, 1.35);
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) two = null;
    if (pts.size === 1 && one) { // sobrou um dedo depois da pinça: recomeça o giro dali
      const p = [...pts.values()][0];
      one = { x: p.x, y: p.y, t: 0, yaw: view.yawT, tilt: view.tiltT, moved: true };
    }
    if (!one || pts.size) return;
    const tap = !one.moved && e.timeStamp - one.t < 450;
    one = null;
    if (!tap) return;
    const now = e.timeStamp;
    if (now - lastTap < 300) { resetView(); lastTap = 0; return; }
    lastTap = now;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const res = denture.handleTap(ray);
    showTooth(res?.tooth);
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);

  // arrasto com dois dedos: move a dentadura no plano da tela, na profundidade em que ela está
  function movePan(start, dx, dy) {
    const parent = pan.parent;
    parent.updateWorldMatrix(true, false);
    const w = parent.localToWorld(start.clone()).project(camera);
    const r = dom.getBoundingClientRect();
    w.x += (dx / r.width) * 2; w.y -= (dy / r.height) * 2;
    pan.position.copy(parent.worldToLocal(w.unproject(camera)));
  }

  // roda do mouse (computador) no modo RA
  if (ar) dom.addEventListener('wheel', (e) => { e.preventDefault(); view.scaleT = THREE.MathUtils.clamp(view.scaleT * Math.exp(-e.deltaY * 0.0015), 0.4, 4); }, { passive: false });
}

/* ---------- modo 1: realidade aumentada com o marcador ---------- */
function setLoading(text, p) {
  ui.loading.hidden = false;
  ui.loadStep.textContent = text;
  ui.loadBar.style.transform = `scaleX(${p})`;
}

async function startAR() {
  ui.intro.hidden = true;
  ui.stage.hidden = false;
  mark('clique');
  try {
    setLoading('Carregando o rastreador…', 0.15);
    const [{ MindARThree }, imageTargetSrc] = await preloadAR();
    setLoading('Abrindo a câmera…', 0.5);
    const mindar = new MindARThree({
      container: ui.stage,
      imageTargetSrc,
      uiLoading: 'no', uiScanning: 'no', uiError: 'no',
      filterMinCF: 0.0001, filterBeta: 0.001,
      warmupTolerance: 2, missTolerance: 8,
    });
    const { renderer, scene, camera } = mindar;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    addLights(scene, renderer);

    // A dentadura não fica presa ao grupo da âncora: copiamos a pose dele.
    // Assim ela continua na tela quando o marcador sai de vista, e dá para "fixar".
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.visible = false;
    holder.add(content);
    scene.add(holder);
    const anchor = mindar.addAnchor(0);
    let pinned = false, tracking = false;
    anchor.onTargetFound = () => {
      tracking = true; ui.scan.hidden = true;
      if (!holder.visible) toast('Arraste para girar · pinça para aproximar · toque num dente');
      holder.visible = true;
    };
    anchor.onTargetLost = () => {
      tracking = false;
      if (!pinned) ui.scan.hidden = holder.visible;
    };
    ui.pin.hidden = false;
    ui.pin.addEventListener('click', () => {
      pinned = !pinned;
      ui.pin.classList.toggle('on', pinned);
      ui.pin.textContent = pinned ? '📌 Solto do marcador' : '📌 Fixar na tela';
      toast(pinned ? 'Fixada: agora pode tirar o marcador da frente e girar à vontade' : 'Seguindo o marcador de novo');
    });

    // o MindAR liga a câmera e depois prepara o rastreador; mostramos as duas etapas
    const origStartAR = mindar._startAR.bind(mindar);
    mindar._startAR = () => { mark('câmera ligada'); setLoading('Preparando o rastreamento…', 0.8); return origStartAR(); };
    await mindar.start();
    mark('rastreador pronto');
    ui.loading.hidden = true;
    ui.hud.hidden = false;
    ui.scan.hidden = false;
    bindGestures(renderer.domElement, camera, { ar: true });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (tracking && !pinned) holder.matrix.copy(anchor.group.matrix);
      holder.matrixWorldNeedsUpdate = true;
      applyView(dt);
      denture.update(dt);
      renderer.render(scene, camera);
      updateLabel(camera, renderer.domElement);
    });
  } catch (err) {
    console.error(err);
    ui.loading.hidden = true;
    ui.stage.hidden = true; ui.intro.hidden = false;
    toast(window.isSecureContext
      ? 'Não deu para abrir a câmera. Libere o acesso à câmera para este site e tente de novo.'
      : 'A câmera só funciona em HTTPS. Publique a página (GitHub Pages, Netlify…) e abra pelo link https.', 7000);
  }
}

/* ---------- modo 2: visualizador 3D sem câmera ---------- */
function start3D() {
  ui.intro.hidden = true;
  ui.stage.hidden = false;
  ui.hud.hidden = false;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  ui.stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10263a');
  addLights(scene, renderer);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 50);
  // celular em pé: afasta a câmera para caber a dentadura inteira na largura
  const home = new THREE.Vector3(0.25, 1.0, 1.6).multiplyScalar(Math.max(1, Math.pow(0.8 / camera.aspect, 0.9)));
  camera.position.copy(home);

  // simula o marcador deitado numa mesa
  const anchorSim = new THREE.Group();
  anchorSim.rotation.x = -Math.PI / 2;
  scene.add(anchorSim);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('./assets/marcador.png', (t) => { t.colorSpace = THREE.SRGBColorSpace; }), roughness: 0.8 }));
  anchorSim.add(card, content);
  const table = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: '#1b3a52', roughness: 1 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.002;
  scene.add(table);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.16, 0);
  controls.enableDamping = true;
  controls.minDistance = 0.25; controls.maxDistance = 4.5;
  controls.update();
  bindGestures(renderer.domElement, camera, { ar: false });
  ui.center.onclick = () => { camera.position.copy(home); controls.target.set(0, 0.16, 0); resetView(); };
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    applyView(dt);
    denture.update(dt);
    controls.update();
    renderer.render(scene, camera);
    updateLabel(camera, renderer.domElement);
  });
  window.__ar = { scene, camera, renderer, denture };
}

/* ---------- interface ---------- */
let toastTimer;
function toast(text, ms = 2800) {
  clearTimeout(toastTimer);
  ui.msg.textContent = text; ui.msg.classList.toggle('show', !!text);
  if (text && ms) toastTimer = setTimeout(() => ui.msg.classList.remove('show'), ms);
}
ui.startAR.addEventListener('click', startAR);
ui.start3D.addEventListener('click', start3D);
ui.pause.addEventListener('click', () => {
  denture.setPaused(!denture.paused);
  ui.pause.innerHTML = denture.paused ? '▶<span>Continuar</span>' : '⏸<span>Pausar</span>';
});
ui.reset.addEventListener('click', () => denture.reset());
ui.mouth.addEventListener('click', () => {
  const open = denture.toggleMouth();
  ui.sep.classList.remove('on');
  ui.mouth.innerHTML = open ? '👄<span>Fechar</span>' : '👄<span>Abrir</span>';
});
ui.sep.addEventListener('click', () => {
  const on = denture.toggleSeparate();
  ui.sep.classList.toggle('on', on);
  ui.mouth.innerHTML = '👄<span>Fechar</span>';
});
ui.center.addEventListener('click', () => { resetView(); denture.select(null); showTooth(null); });
ui.exit.addEventListener('click', () => location.reload());
setTimeout(() => ui.hint.classList.add('fade'), 9000);
if (new URLSearchParams(location.search).has('3d')) start3D();
