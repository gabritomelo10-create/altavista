import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VERTICAL } from './brand-paths.js';

const C = {
  mata: 0x193c30, floresta: 0x284b3b, salvia: 0xa0ad91, dourado: 0xb79a58, douradoClaro: 0xd7c18c, mineral: 0xe8e3d5,
};

/** Separa o símbolo em faixas (uma por contorno) para montar camadas em profundidade. */
export function symbolBands(depth = 16) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="${VERTICAL.symbol}"/></svg>`);
  const shapes = SVGLoader.createShapes(data.paths[0]);
  const withArea = shapes.map((s) => ({ s, a: Math.abs(THREE.ShapeUtils.area(s.getPoints(24))) }));
  withArea.sort((a, b) => b.a - a.a); // de fora para dentro
  return withArea.map(({ s }, i) => {
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 1.1, bevelSegments: 4, curveSegments: 28 });
    g.userData.index = i;
    return g;
  });
}

export function initHero(canvas, pointer) {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL indisponível');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.background = backdropTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  /* ---------- símbolo em camadas ---------- */
  const root = new THREE.Group(); scene.add(root);
  const tilt = new THREE.Group(); root.add(tilt);
  const symbol = new THREE.Group(); tilt.add(symbol);

  const gold = new THREE.MeshPhysicalMaterial({
    color: C.dourado, metalness: 1, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.25,
    sheen: 0.4, sheenColor: new THREE.Color(C.douradoClaro), envMapIntensity: 1.2,
  });
  const goldLight = gold.clone(); goldLight.color = new THREE.Color(C.douradoClaro); goldLight.roughness = 0.22;

  const bands = symbolBands();
  const SCALE = 0.0115;
  const layers = bands.map((g, i) => {
    const m = new THREE.Mesh(g, i === bands.length - 1 ? goldLight : gold);
    m.userData = { i, z: 0, vz: 0, base: 0 };
    symbol.add(m);
    return m;
  });
  // centraliza e corrige eixo Y do SVG
  const box = new THREE.Box3().setFromObject(symbol);
  const center = box.getCenter(new THREE.Vector3());
  symbol.children.forEach((m) => m.geometry.translate(-center.x, -center.y, 0));
  symbol.scale.set(SCALE, -SCALE, SCALE);

  /* ---------- “lago” — disco de luz no vazio central ---------- */
  const lakeTex = radialTexture('rgba(215,193,140,0.9)', 'rgba(160,173,145,0.0)');
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: lakeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  lake.position.z = -0.6; tilt.add(lake);

  /* ---------- luzes ---------- */
  scene.add(new THREE.AmbientLight(C.salvia, 0.25));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.2); key.position.set(3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(C.salvia, 2.4); rim.position.set(-5, -2, -4); scene.add(rim);
  const mouseLight = new THREE.PointLight(C.douradoClaro, 16, 14, 1.6); mouseLight.position.set(0, 0, 4); scene.add(mouseLight);

  /* ---------- partículas com profundidade de campo ---------- */
  const N = innerWidth < 760 ? 260 : 620;
  const pos = new Float32Array(N * 3); const seed = new Float32Array(N); const col = new Float32Array(N * 3);
  const cA = new THREE.Color(C.douradoClaro); const cB = new THREE.Color(C.salvia); const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 11;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 1;
    seed[i] = Math.random();
    tmp.copy(cA).lerp(cB, Math.random() * 0.8); col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uFocus: { value: 11 }, uPx: { value: renderer.getPixelRatio() }, uMouse: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime; uniform float uFocus; uniform float uPx; uniform vec2 uMouse;
      varying float vBlur; varying float vAlpha; varying vec3 vColor;
      void main(){
        vec3 p = position;
        p.y += mod(uTime * (0.08 + seed * 0.12) + seed * 11.0, 11.0) - 5.5 - position.y * 0.0;
        p.x += sin(uTime * 0.3 + seed * 20.0) * 0.25 + uMouse.x * (p.z + 6.0) * 0.06;
        p.y += uMouse.y * (p.z + 6.0) * 0.04;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        float coc = clamp(abs(dist - uFocus) / 5.0, 0.0, 1.0);   // círculo de confusão
        vBlur = coc;
        vAlpha = mix(0.9, 0.18, coc) * (0.5 + 0.5 * sin(uTime * (0.6 + seed) + seed * 30.0));
        vColor = color;
        gl_PointSize = (2.0 + seed * 3.0 + coc * 26.0) * uPx * (10.0 / dist);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vBlur; varying float vAlpha; varying vec3 vColor;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float edge = mix(0.15, 0.95, vBlur);
        float a = 1.0 - smoothstep(1.0 - edge, 1.0, d);
        // anel suave típico de bokeh
        a *= mix(1.0, 0.65 + 0.35 * smoothstep(0.55, 0.95, d), vBlur);
        gl_FragColor = vec4(vColor, a * vAlpha);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------- pós-processamento ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- estado e interação ---------- */
  const state = { spread: 0, targetSpread: 0.05, scroll: 0, intro: 0, hover: 0, rotX: 0, rotY: 0 };
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let hovering = false;

  function layout() {
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const mobile = w < 760;
    root.position.set(mobile ? 0 : 2.15 * Math.min(1, camera.aspect / 1.6), mobile ? 1.25 : 0.25, 0);
    root.scale.setScalar(mobile ? 0.62 : 1);
  }
  layout();
  addEventListener('resize', layout);

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    hovering = ray.intersectObjects(layers, false).length > 0;
  });
  canvas.addEventListener('click', () => ripple());

  function ripple() {
    // a onda nasce no lago e percorre as margens
    const n = layers.length;
    layers.forEach((m, i) => { setTimeout(() => { m.userData.vz += 0.55; }, (n - 1 - i) * 70); });
    lake.material.opacity = 1.2;
  }

  let visible = true; let running = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || !running) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;

    state.hover += ((hovering ? 1 : 0) - state.hover) * 0.06;
    const breathe = 0.05 + Math.sin(t * 0.8) * 0.025;
    const target = breathe + state.hover * 0.22 + state.scroll * 1.25;
    state.spread += (target - state.spread) * 0.06;

    const n = layers.length;
    layers.forEach((m, i) => {
      const u = m.userData;
      // mola (ripple)
      u.vz += -u.z * 9 * dt; u.vz *= 1 - 3.2 * dt; u.z += u.vz * dt * 6;
      const depthIndex = n - 1 - i; // o lago (interno) vem à frente
      m.position.z = (depthIndex * state.spread + u.z) * (1 / SCALE) * 0.42;
    });
    lake.material.opacity += (0.55 - lake.material.opacity) * 0.04;

    // inclinação pelo mouse + scroll (vira “mapa topográfico”)
    const mx = pointer.nx || 0; const my = pointer.ny || 0;
    state.rotY += (mx * 0.45 - state.rotY) * 0.05;
    state.rotX += (my * 0.3 - state.rotX) * 0.05;
    tilt.rotation.y = state.rotY + Math.sin(t * 0.35) * 0.08;
    tilt.rotation.x = state.rotX - state.scroll * 1.05 + Math.cos(t * 0.3) * 0.04;
    tilt.rotation.z = state.scroll * 0.35;
    tilt.position.y = Math.sin(t * 0.7) * 0.06 - state.scroll * 0.8;
    const s = 0.6 + state.intro * 0.4 + state.scroll * 0.25;
    tilt.scale.setScalar(s);

    mouseLight.position.set(mx * 5 + root.position.x, -my * 3.2, 3.2);
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uMouse.value.set(mx, -my);
    particles.rotation.y = mx * 0.05;
    camera.position.y = -state.scroll * 0.6;
    camera.lookAt(0, -state.scroll * 0.6, 0);

    composer.render();
  }
  frame();

  return {
    intro() {
      const o = { v: 0 };
      // entrada: as margens chegam de longe e se assentam
      layers.forEach((m) => { m.userData.z = 2.5 + Math.random(); });
      window.gsap.to(o, { v: 1, duration: 2.4, ease: 'expo.out', onUpdate: () => { state.intro = o.v; } });
    },
    setScroll(p) { state.scroll = p; },
  };
}

/** Fundo em degradê Mata → Floresta com um toque de dourado (cores da paleta). */
function backdropTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(700, 290, 20, 640, 320, 760);
  grd.addColorStop(0, '#3a5540'); grd.addColorStop(0.18, '#284B3B'); grd.addColorStop(0.55, '#193C30'); grd.addColorStop(1, '#0f251d');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 640);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
