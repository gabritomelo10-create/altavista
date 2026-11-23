import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDenture } from './dentes.js';

const $ = (s) => document.querySelector(s);
const ui = {
  intro: $('#intro'), hud: $('#hud'), scan: $('#scan'), stage: $('#stage'), msg: $('#msg'),
  count: $('#count'), bar: $('#bar'), pause: $('#btn-pause'), reset: $('#btn-reset'), exit: $('#btn-exit'),
  startAR: $('#btn-ar'), start3D: $('#btn-3d'), secure: $('#secure-warning'),
};

if (!window.isSecureContext) ui.secure.hidden = false;

/* ---------- conteúdo que fica "em cima" do marcador ---------- */
// Espaço do marcador (igual ao do MindAR): x para a direita, y para cima na imagem,
// z saindo do papel. 1 unidade = largura da imagem impressa.
const MODEL_SCALE = 0.125;
const denture = createDenture({
  onProgress(done, total) {
    ui.count.textContent = `${done}/${total}`;
    ui.bar.style.transform = `scaleX(${done / total})`;
    if (done === total) toast('Tudo limpo! ✨ A sujeira volta em instantes.');
  },
});

const content = new THREE.Group();     // fica dentro da âncora
const lift = new THREE.Group();        // em pé sobre o papel
lift.rotation.x = Math.PI / 2;
lift.position.z = 1.0 * MODEL_SCALE;
lift.scale.setScalar(MODEL_SCALE);
lift.add(denture.root);
content.add(lift);

// sombra suave no papel
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.85), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.position.z = 0.002;
  content.add(shadow);
}

function addLights(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#ffffff', '#88606a', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(0.6, -0.8, 1.6);
  scene.add(key);
}

/* ---------- interação: toque, arrastar para girar, pinça para escalar ---------- */
function bindPointer(dom, camera, { allowRotate }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pts = new Map();
  let down = null, pinch = null;
  dom.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), rot: denture.root.rotation.y, moved: false };
    if (pts.size === 2 && allowRotate) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: lift.scale.x };
      if (down) down.moved = true;
    }
  });
  dom.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const s = THREE.MathUtils.clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, MODEL_SCALE * 0.5, MODEL_SCALE * 3);
      lift.scale.setScalar(s); lift.position.z = 1.0 * s;
      return;
    }
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
    if (allowRotate && down.moved) denture.root.rotation.y = down.rot + dx * 0.012;
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!down || pts.size) return;
    const tap = !down.moved && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const what = denture.handleTap(ray);
    if (what === 'boca') toast('Boca abre e fecha tocando nos dentes de cima');
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
}

/* ---------- modo 1: realidade aumentada com o marcador ---------- */
async function startAR() {
  ui.intro.hidden = true;
  ui.stage.hidden = false;
  toast('Abrindo a câmera…', 0);
  try {
    const { MindARThree } = await import('./vendor/mindar/mindar-image-three.prod.js');
    const mindar = new MindARThree({
      container: ui.stage,
      imageTargetSrc: './assets/marcador.mind',
      uiLoading: 'no', uiScanning: 'no', uiError: 'no',
      filterMinCF: 0.0001, filterBeta: 0.001,
    });
    const { renderer, scene, camera } = mindar;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    addLights(scene, renderer);
    const anchor = mindar.addAnchor(0);
    anchor.group.add(content);
    anchor.onTargetFound = () => { ui.scan.hidden = true; };
    anchor.onTargetLost = () => { ui.scan.hidden = false; };
    await mindar.start();
    toast('');
    ui.hud.hidden = false; ui.scan.hidden = false;
    bindPointer(renderer.domElement, camera, { allowRotate: true });
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { denture.update(clock.getDelta()); renderer.render(scene, camera); });
  } catch (err) {
    console.error(err);
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
  camera.position.set(0.25, 1.0, 1.6);

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
  controls.minDistance = 0.4; controls.maxDistance = 3;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();
  bindPointer(renderer.domElement, camera, { allowRotate: false });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => { denture.update(clock.getDelta()); controls.update(); renderer.render(scene, camera); });
  window.__ar = { scene, camera, renderer, denture };
}

/* ---------- interface ---------- */
let toastTimer;
function toast(text, ms = 2600) {
  clearTimeout(toastTimer);
  ui.msg.textContent = text; ui.msg.classList.toggle('show', !!text);
  if (text && ms) toastTimer = setTimeout(() => ui.msg.classList.remove('show'), ms);
}
ui.startAR.addEventListener('click', startAR);
ui.start3D.addEventListener('click', start3D);
ui.pause.addEventListener('click', () => {
  denture.setPaused(!denture.paused);
  ui.pause.textContent = denture.paused ? '▶ Continuar' : '⏸ Pausar';
});
ui.reset.addEventListener('click', () => denture.reset());
ui.exit.addEventListener('click', () => location.reload());
if (new URLSearchParams(location.search).has('3d')) start3D();
