import { VERTICAL, SYMBOL_VIEWBOX, HORIZONTAL, P01 } from './brand-paths.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';

/* ------------------------------------------------------------------
   Logos: monta SVG inline a partir dos vetores oficiais do guia
------------------------------------------------------------------- */
const subpaths = (d) => d.split(/(?=M )/).map((s) => s.trim()).filter(Boolean);

function svg(viewBox, inner, attrs = '') {
  return `<svg xmlns="${NS}" viewBox="${viewBox}" ${attrs} aria-hidden="true" focusable="false">${inner}</svg>`;
}
const fillPath = (d, cls = '') => `<path class="${cls}" fill="currentColor" fill-rule="evenodd" d="${d}"/>`;

const LOGOS = {
  vertical: () => svg(VERTICAL.viewBox, fillPath(VERTICAL.symbol) + fillPath(VERTICAL.lettering) + fillPath(VERTICAL.residence)),
  horizontal: () => svg(HORIZONTAL.viewBox, HORIZONTAL.paths.map((d) => fillPath(d)).join('')),
  symbol: () => svg(SYMBOL_VIEWBOX, fillPath(VERTICAL.symbol)),
  p01: () => svg(P01.viewBox, fillPath(P01.d), 'preserveAspectRatio="xMidYMid meet"'),
  'symbol-draw': () => svg(SYMBOL_VIEWBOX, subpaths(VERTICAL.symbol).map((d) => `<path class="stroke" d="${d}"/>`).join('') + `<path class="full" fill-rule="evenodd" d="${VERTICAL.symbol}"/>`),
};
$$('[data-logo]').forEach((el) => {
  const make = LOGOS[el.dataset.logo];
  if (make) el.innerHTML = make();
});

// gradiente dourado compartilhado (Dourado sobre Mata)
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9c8048"/><stop offset=".35" stop-color="#B79A58"/><stop offset=".55" stop-color="#D7C18C"/><stop offset=".75" stop-color="#B79A58"/><stop offset="1" stop-color="#8f7442"/>
  </linearGradient></defs></svg>`);

/* ------------------------------------------------------------------
   Smooth scroll (Lenis) + ScrollTrigger
------------------------------------------------------------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    $('.nav').classList.remove('is-open');
    if (lenis) lenis.scrollTo(target, { duration: 1.8 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

/* ------------------------------------------------------------------
   Split text / reveals
------------------------------------------------------------------- */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words.map((w) => `<span class="split-line" aria-hidden="true"><span>${w}</span></span>`).join(' ');
  return $$('.split-line > span', el);
}
const splitTargets = $$('[data-split]').map((el) => ({ el, words: splitWords(el) }));

$$('[data-words]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
});

/* ------------------------------------------------------------------
   Cursor
------------------------------------------------------------------- */
const cursor = $('.cursor');
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
if (finePointer) {
  const dotX = gsap.quickTo('.cursor__dot', 'x', { duration: 0.08 });
  const dotY = gsap.quickTo('.cursor__dot', 'y', { duration: 0.08 });
  const ringX = gsap.quickTo('.cursor__ring', 'x', { duration: 0.45, ease: 'power3' });
  const ringY = gsap.quickTo('.cursor__ring', 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY);
  });
  window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  const label = $('.cursor__label');
  const hoverSel = 'a, button, input, [data-cursor], [data-tilt], [data-lightbox], .swatch, .studio__canvas, .hero__canvas';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest(hoverSel);
    if (!t) return;
    const text = t.closest('[data-cursor]')?.dataset.cursor ?? '';
    label.textContent = text;
    cursor.classList.add('is-hover');
    cursor.classList.toggle('no-label', !text);
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest(hoverSel);
    if (t && !t.contains(e.relatedTarget)) cursor.classList.remove('is-hover');
  });
} else {
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
}
window.addEventListener('pointermove', () => {
  pointer.nx = (pointer.x / innerWidth) * 2 - 1;
  pointer.ny = (pointer.y / innerHeight) * 2 - 1;
});

/* ------------------------------------------------------------------
   Loader → intro
------------------------------------------------------------------- */
const loader = $('#loader');
const drawPaths = $$('#loader path.stroke');
drawPaths.forEach((p) => {
  const len = p.getTotalLength();
  p.style.strokeDasharray = len;
  p.style.strokeDashoffset = len;
});

const ready = Promise.all([
  new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
  document.fonts ? document.fonts.ready : Promise.resolve(),
]);

const counter = { v: 0 };
const loadTl = gsap.timeline();
loadTl
  .to(drawPaths, { strokeDashoffset: 0, duration: reduceMotion ? 0.01 : 1.6, ease: 'power2.inOut', stagger: 0.07 }, 0)
  .to(counter, { v: 92, duration: 1.8, ease: 'power1.out', onUpdate: () => ($('#loaderCount').textContent = Math.round(counter.v)) }, 0);

let heroApi = null;
ready.then(async () => {
  try { heroApi = await import('./hero3d.js').then((m) => m.initHero($('#heroCanvas'), pointer)); }
  catch (err) { console.warn('Hero 3D indisponível:', err); $('.hero').classList.add('hero--nogl'); }
  loadTl.then(() => {
    gsap.timeline({ onComplete: () => { loader.remove(); document.body.classList.remove('is-loading'); lenis?.start(); } })
      .to(counter, { v: 100, duration: 0.3, onUpdate: () => ($('#loaderCount').textContent = Math.round(counter.v)) })
      .to('#loader path.full', { opacity: 1, duration: 0.6, ease: 'power2.out' }, '<')
      .to(drawPaths, { strokeOpacity: 0, duration: 0.5 }, '<')
      .to('.loader__mark', { scale: 1.6, opacity: 0, duration: 0.9, ease: 'power3.in' }, '+=0.15')
      .to('.loader__count', { opacity: 0, duration: 0.3 }, '<')
      .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.35')
      .add(() => { heroApi?.intro(); introHero(); }, '-=0.7');
  });
});

function introHero() {
  const hero = splitTargets.find((s) => s.el.classList.contains('hero__title'));
  gsap.fromTo(hero.words, { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.07 });
  gsap.to('.hero .reveal-up', { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.3 });
  gsap.from(['.nav', '.hero__hint', '.hero__meta'], { opacity: 0, y: -10, duration: 1, delay: 0.6, stagger: 0.1 });
}

/* ------------------------------------------------------------------
   Reveals ao rolar
------------------------------------------------------------------- */
splitTargets.forEach(({ el, words }) => {
  if (el.classList.contains('hero__title')) return;
  gsap.fromTo(words, { yPercent: 110 }, {
    yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05,
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
  });
});
$$('.reveal-up').forEach((el) => {
  if (el.closest('.hero')) return;
  gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
});

// manifesto palavra por palavra
const manifestoWords = $$('.manifesto__text .w');
gsap.to(manifestoWords, {
  opacity: 1, stagger: 0.05, ease: 'none',
  scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: true },
});
gsap.from('.chapters li', { y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.chapters', start: 'top 85%', once: true } });

// progresso
gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

/* ------------------------------------------------------------------
   Nav (claro/escuro, esconder ao descer, capítulo ativo)
------------------------------------------------------------------- */
const nav = $('.nav');
$('.nav__menu').addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  $('.nav__menu').setAttribute('aria-expanded', open);
});
ScrollTrigger.create({ start: 80, onToggle: (s) => nav.classList.toggle('is-scrolled', s.isActive) });
let lastY = 0;
const toneSections = $$('main > section');
function updateNavTone() {
  const sec = toneSections.find((el) => { const r = el.getBoundingClientRect(); return r.top <= 40 && r.bottom > 40; });
  if (sec) nav.classList.toggle('is-light', sec.matches('.section--mineral, .section--salvia'));
}
function onScrollNav() {
  const y = window.scrollY;
  if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
  lastY = y;
  updateNavTone();
}
window.addEventListener('scroll', onScrollNav, { passive: true });
['essencia', 'simbolo', 'cores', 'tipografia', 'linguagem', 'aplicacoes'].forEach((id, i, arr) => {
  const link = $(`.nav__links a[href="#${id}"]`);
  const next = arr[i + 1] ? `#${arr[i + 1]}` : '#fim';
  ScrollTrigger.create({ trigger: `#${id}`, endTrigger: next, start: 'top 50%', end: 'top 50%', onToggle: (s) => link.classList.toggle('is-active', s.isActive) });
});

/* ------------------------------------------------------------------
   Parallax
------------------------------------------------------------------- */
$$('[data-parallax]').forEach((el) => {
  const amt = parseFloat(el.dataset.parallax) * 100;
  gsap.fromTo(el, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});
$$('.chapter-cover .chapter-cover__content').forEach((el) => {
  gsap.fromTo(el, { y: 80 }, { y: -80, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});
$$('.parallax-inner').forEach((el) => {
  gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});
$$('[data-drift]').forEach((el) => {
  const dir = parseFloat(el.dataset.drift);
  gsap.fromTo(el, { xPercent: -12 * dir }, { xPercent: 12 * dir, ease: 'none', scrollTrigger: { trigger: '.naming', start: 'top bottom', end: 'bottom top', scrub: true } });
});
// hero content sai com o scroll
gsap.to('.hero__content', { y: -120, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onUpdate: (s) => heroApi?.setScroll(s.progress) });

// luz que segue o mouse no hero
const heroEl = $('.hero');
heroEl.addEventListener('pointermove', (e) => {
  const r = heroEl.getBoundingClientRect();
  heroEl.style.setProperty('--lx', `${((e.clientX - r.left) / r.width) * 100}%`);
  heroEl.style.setProperty('--ly', `${((e.clientY - r.top) / r.height) * 100}%`);
});

/* ------------------------------------------------------------------
   Tilt 3D + brilho
------------------------------------------------------------------- */
if (finePointer && !reduceMotion) {
  $$('[data-tilt]').forEach((el) => {
    const glare = $('.tilt-card__glare', el);
    const max = el.classList.contains('material__media') || el.classList.contains('photo__media') ? 6 : 10;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      gsap.to(el, { rotationY: (px - 0.5) * max * 2, rotationX: -(py - 0.5) * max * 2, transformPerspective: 1000, duration: 0.6, ease: 'power3.out' });
      if (glare) { el.style.setProperty('--gx', `${px * 100}%`); el.style.setProperty('--gy', `${py * 100}%`); }
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotationX: 0, rotationY: 0, duration: 1.2, ease: 'elastic.out(1, .5)' }));
  });
}
gsap.from('.pillars3 .tilt-card', { y: 80, opacity: 0, rotationX: -20, duration: 1.4, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.pillars3', start: 'top 85%', once: true } });
gsap.from('.values .value', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.values', start: 'top 88%', once: true } });
gsap.from('.combo', { y: 70, opacity: 0, rotationX: -15, duration: 1.3, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.combos', start: 'top 85%', once: true } });

// comprimento dos traços dos ícones para a animação de desenho
$$('.icon > *').forEach((p) => p.style.setProperty('--len', Math.ceil(p.getTotalLength?.() ?? 300)));

/* ------------------------------------------------------------------
   Construção do símbolo (seção fixada)
------------------------------------------------------------------- */
(function buildSequence() {
  const host = $('#buildLogo');
  const subs = subpaths(VERTICAL.symbol);
  // identifica o contorno mais interno (o "lago") pela menor área de bbox
  const areas = subs.map((d) => {
    const n = d.match(/-?\d+\.?\d*/g).map(Number);
    const xs = n.filter((_, i) => i % 2 === 0); const ys = n.filter((_, i) => i % 2 === 1);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  });
  const order = subs.map((_, i) => i).sort((a, b) => areas[a] - areas[b]); // de dentro para fora
  const lakeIdx = order[0];
  host.innerHTML = svg(VERTICAL.viewBox, `
    <circle class="b-guide b-seal" cx="639.5" cy="337.5" r="182"/>
    <path class="b-lake" d="${subs[lakeIdx]}"/>
    ${order.map((i) => `<path class="b-stroke" data-i="${i}" d="${subs[i]}"/>`).join('')}
    <path class="b-fill" fill-rule="evenodd" d="${VERTICAL.symbol}"/>
    <clipPath id="letterClip"><rect class="b-clip" x="330" y="500" width="0" height="170"/></clipPath>
    <g clip-path="url(#letterClip)"><path class="b-letter" fill-rule="evenodd" d="${VERTICAL.lettering}"/></g>
    <path class="b-res" fill-rule="evenodd" d="${VERTICAL.residence}"/>
    <line class="b-guide b-base" x1="330" x2="950" y1="606" y2="606"/>`);

  const strokes = $$('.b-stroke', host);
  strokes.forEach((p) => { const l = p.getTotalLength(); p.style.strokeDasharray = l; p.style.strokeDashoffset = l; });
  const seal = $('.b-seal', host); const sealLen = seal.getTotalLength();
  seal.style.strokeDasharray = `4 6`;
  gsap.set(seal, { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' });
  gsap.set($('.b-lake', host), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%', transformBox: 'fill-box' });
  gsap.set($('.b-fill', host), { opacity: 0 });
  gsap.set($('.b-res', host), { opacity: 0, scaleX: 0.6, transformOrigin: '50% 50%', transformBox: 'fill-box' });
  gsap.set($('.b-base', host), { opacity: 0, scaleX: 0, transformOrigin: '50% 50%', transformBox: 'fill-box' });
  gsap.set(host, { y: 90 });

  const steps = $$('.build__steps li');
  const setStep = (p) => {
    const i = Math.min(3, Math.floor(p * 4.0001));
    steps.forEach((li, k) => li.classList.toggle('is-active', k === i));
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.build', start: 'top top', end: () => `+=${innerHeight * 3.2}`, pin: '.build__pin', scrub: 0.8,
      onUpdate: (s) => { setStep(s.progress); gsap.set('.build__bar span', { scaleX: s.progress }); },
    },
  });
  tl.to($('.b-lake', host), { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 0)
    .to(strokes[0], { strokeDashoffset: 0, duration: 0.7 }, 0.1)
    .to(strokes.slice(1), { strokeDashoffset: 0, duration: 0.8, stagger: 0.12 }, 1)
    .to(seal, { opacity: 1, scale: 1, rotate: 40, duration: 0.8 }, 2)
    .to($('.b-fill', host), { opacity: 1, duration: 0.6 }, 2.2)
    .to($('.b-lake', host), { opacity: 0, duration: 0.5 }, 2.4)
    .to(strokes, { opacity: 0, duration: 0.4 }, 2.6)
    .to(seal, { opacity: 0, scale: 1.15, duration: 0.5 }, 2.9)
    .to(host, { y: 0, duration: 0.8 }, 3)
    .to($('.b-base', host), { opacity: 1, scaleX: 1, duration: 0.5 }, 3)
    .to($('.b-clip', host), { attr: { width: 620 }, duration: 0.9 }, 3.2)
    .to($('.b-res', host), { opacity: 1, scaleX: 1, duration: 0.6 }, 3.7)
    .to($('.b-base', host), { opacity: 0, duration: 0.3 }, 4.1)
    .to({}, { duration: 0.3 });
  void sealLen;
})();

/* ------------------------------------------------------------------
   Versões, proteção e redução
------------------------------------------------------------------- */
const versionCopy = {
  vertical: 'A expressão completa da marca. O símbolo, o nome e o descritor mantêm suas relações de proporção e alinhamento.',
  horizontal: 'Uma adaptação de composição para espaços horizontais. O desenho das letras e do selo permanece preservado.',
  symbol: 'Para contextos em que a marca já está identificada, como avatar e detalhes de acabamento.',
};
const clearBox = $('.versions__clear');
function placeClear() {
  const active = $('.versions__logo.is-active');
  const stage = $('.versions__stage');
  const svgEl = $('svg', active);
  if (!svgEl) return;
  const r = svgEl.getBoundingClientRect(); const s = stage.getBoundingClientRect();
  // x = 1/4 da largura do símbolo
  const symW = active.dataset.versionPanel === 'horizontal' ? r.width * (146 / 660) : active.dataset.versionPanel === 'vertical' ? r.width * (349 / 620) : r.width;
  const x = symW / 4;
  clearBox.style.inset = `${r.top - s.top - x}px ${s.right - r.right - x}px ${s.bottom - r.bottom - x}px ${r.left - s.left - x}px`;
}
$$('.versions__tabs button').forEach((b) => b.addEventListener('click', () => {
  $$('.versions__tabs button').forEach((x) => x.classList.toggle('is-active', x === b));
  $$('.versions__logo').forEach((p) => p.classList.toggle('is-active', p.dataset.versionPanel === b.dataset.version));
  $('[data-version-copy]').textContent = versionCopy[b.dataset.version];
  requestAnimationFrame(placeClear);
}));
$('.versions__stage').addEventListener('pointerenter', placeClear);
addEventListener('resize', placeClear);

const range = $('#reductionRange');
const redLogo = $('#reductionLogo');
const setRange = (el) => el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
function updateReduction() {
  const w = +range.value;
  setRange(range);
  let kind = 'vertical'; let msg = 'Vertical — dentro da referência (mín. 320 px / 60 mm)';
  if (w < 320 && w >= 48) { kind = 'symbol'; msg = 'Abaixo de 320 px: preferir o símbolo isolado em uma cor (mín. 48 px / 12 mm)'; }
  if (w < 48) { kind = 'symbol'; msg = 'Abaixo do mínimo de 48 px — os vazios entre contornos se perdem'; }
  if (redLogo.dataset.kind !== kind) { redLogo.dataset.kind = kind; redLogo.querySelector('span').innerHTML = LOGOS[kind](); }
  redLogo.style.width = `${w}px`;
  redLogo.style.opacity = w < 48 ? 0.45 : 1;
  $('#reductionPx').textContent = `${w} px`;
  $('#reductionVerdict').textContent = msg;
}
range.addEventListener('input', updateReduction);
updateReduction();

/* ------------------------------------------------------------------
   Fundos
------------------------------------------------------------------- */
const bgStage = $('#bgStage');
$$('.bg-switch__opts button').forEach((b) => b.addEventListener('click', () => {
  $$('.bg-switch__opts button').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', x === b); });
  bgStage.dataset.bg = b.dataset.bg;
  gsap.fromTo('.bg-switch__logo', { scale: 0.94, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'expo.out' });
}));
bgStage.addEventListener('pointermove', (e) => {
  const r = bgStage.getBoundingClientRect();
  bgStage.style.setProperty('--lx', `${((e.clientX - r.left) / r.width) * 100}%`);
  bgStage.style.setProperty('--ly', `${((e.clientY - r.top) / r.height) * 100}%`);
});
gsap.from('.misuse__card', { y: 60, opacity: 0, rotationY: -40, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.misuse', start: 'top 85%', once: true } });

/* ------------------------------------------------------------------
   Paleta
------------------------------------------------------------------- */
const toast = $('#toast');
let toastT;
function showToast(html) {
  toast.innerHTML = html; toast.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1800);
}
$$('.swatch').forEach((s) => s.addEventListener('click', async () => {
  const hex = s.dataset.hex;
  try { await navigator.clipboard.writeText(hex); } catch { /* sem permissão */ }
  showToast(`<i style="background:${hex}"></i>${s.querySelector('.swatch__name').textContent} ${hex} copiado`);
}));
gsap.from('.swatch', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: '.swatches', start: 'top 85%', once: true } });

/* ------------------------------------------------------------------
   Tipografia
------------------------------------------------------------------- */
const tester = $('#typeTester');
const fonts = { serif: ['var(--serif)', 400], sans: ['var(--sans)', 400], 'sans-semi': ['var(--sans)', 600] };
$$('.seg button').forEach((b) => b.addEventListener('click', () => {
  $$('.seg button').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', x === b); });
  const [f, w] = fonts[b.dataset.font];
  gsap.to(tester, { opacity: 0, y: 10, duration: 0.2, onComplete: () => { tester.style.fontFamily = f; tester.style.fontWeight = w; gsap.to(tester, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }); } });
}));
const typeSize = $('#typeSize');
function updateType() { setRange(typeSize); tester.style.fontSize = `${typeSize.value}px`; $('#typeSizeOut').textContent = `${typeSize.value} px`; }
typeSize.addEventListener('input', updateType);
updateType();
if (innerWidth < 760) { typeSize.value = 44; updateType(); }

/* ------------------------------------------------------------------
   P01 — camadas com profundidade de campo
------------------------------------------------------------------- */
(function p01Art() {
  const art = $('#p01Art');
  art.innerHTML = svg(P01.viewBox, `
    <g class="p01-back" style="filter:blur(7px)"><path fill-rule="evenodd" d="${P01.d}" fill="#A0AD91" opacity=".28"/></g>
    <g class="p01-mid" style="filter:blur(2px)"><path fill-rule="evenodd" d="${P01.d}" fill="#A0AD91" opacity=".45"/></g>
    <g class="p01-front"><path fill-rule="evenodd" d="${P01.d}" fill="#A0AD91"/></g>`, 'preserveAspectRatio="xMidYMid meet"');
  const front = $('.p01-front', art); const mid = $('.p01-mid', art); const back = $('.p01-back', art);
  [front, mid, back].forEach((g) => gsap.set(g, { transformOrigin: '50% 50%', transformBox: 'fill-box' }));
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.p01', start: 'top top', end: () => `+=${innerHeight * 1.6}`, pin: '.p01__pin', scrub: 1 } });
  tl.fromTo(front, { x: 520, y: 80, scale: 0.85 }, { x: 0, y: 0, scale: 1, duration: 1 }, 0)
    .fromTo(mid, { x: 760, y: -40, scale: 1.25, rotate: -6 }, { x: 140, y: -70, scale: 1.3, rotate: -3, duration: 1 }, 0)
    .fromTo(back, { x: 900, y: 120, scale: 1.7, rotate: 8 }, { x: 260, y: 40, scale: 1.8, rotate: 4, duration: 1 }, 0)
    .fromTo('.p01__copy', { y: 40 }, { y: -40, duration: 1 }, 0);
  if (finePointer && !reduceMotion) {
    const sec = $('.p01');
    sec.addEventListener('pointermove', () => {
      gsap.to('#p01Art', { rotationY: pointer.nx * 6, rotationX: -pointer.ny * 4, x: pointer.nx * -20, transformPerspective: 1200, duration: 1.2, ease: 'power3.out' });
    });
  }
})();
$$('.compose__card').forEach((c) => {
  const p = $('.compose__p01', c);
  const base = getComputedStyle(p).transform;
  c.addEventListener('pointerenter', () => gsap.to(p, { x: -24, duration: 1.2, ease: 'expo.out' }));
  c.addEventListener('pointerleave', () => gsap.to(p, { x: 0, duration: 1.2, ease: 'expo.out' }));
  void base;
});

/* ------------------------------------------------------------------
   Tapume 3D (painéis que se abrem como dominó)
------------------------------------------------------------------- */
(function hoarding() {
  const panels = $$('#hoardingWall .panel');
  gsap.set(panels, { rotationY: -95, opacity: 0, transformOrigin: '0% 50%' });
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.hoarding', start: 'top top', end: () => `+=${innerHeight * 2.2}`, pin: '.hoarding__pin', scrub: 1 } });
  tl.fromTo('#hoardingWall', { rotationY: -48, rotationX: 6, xPercent: -20, z: -300 }, { rotationY: -14, rotationX: 2, xPercent: -62, z: 0, duration: 1 }, 0)
    .to(panels, { rotationY: 0, opacity: 1, duration: 0.35, stagger: 0.09, ease: 'power2.out' }, 0.02);
})();

/* ------------------------------------------------------------------
   Instagram / stories em 3D
------------------------------------------------------------------- */
(function devices() {
  const wrap = $('#devices');
  const tab = $('.device--tablet'); const phone = $('.device--phone');
  gsap.from([tab, phone], { y: 160, rotationX: 40, opacity: 0, duration: 1.6, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: wrap, start: 'top 85%', once: true } });
  gsap.to(phone, { y: -60, ease: 'none', scrollTrigger: { trigger: '.social', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.to(tab, { y: 30, ease: 'none', scrollTrigger: { trigger: '.social', start: 'top bottom', end: 'bottom top', scrub: true } });
  if (!finePointer || reduceMotion) return;
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(tab, { rotationY: 18 + px * 16, rotationX: 6 - py * 12, duration: 1, ease: 'power3.out' });
    gsap.to(phone, { rotationY: -14 + px * 20, rotationX: 6 - py * 14, duration: 1, ease: 'power3.out' });
  });
  wrap.addEventListener('pointerleave', () => {
    gsap.to(tab, { rotationY: 18, rotationX: 6, duration: 1.4, ease: 'expo.out' });
    gsap.to(phone, { rotationY: -14, rotationX: 6, duration: 1.4, ease: 'expo.out' });
  });
})();

/* ------------------------------------------------------------------
   Galeria horizontal
------------------------------------------------------------------- */
(function gallery() {
  const track = $('#galleryTrack');
  const cards = $$('.gcard', track);
  const dist = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.gallery', start: 'top top', end: () => `+=${dist()}`, pin: '.gallery__pin', scrub: 1, invalidateOnRefresh: true,
      onUpdate: (s) => { $('#galleryIndex').textContent = String(Math.min(cards.length, Math.round(s.progress * (cards.length - 1)) + 1)).padStart(2, '0'); },
    },
  });
  cards.forEach((c) => {
    gsap.fromTo($('img', c), { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    gsap.fromTo($('.gcard__img', c), { rotationY: -12, scale: 0.92 }, { rotationY: 0, scale: 1, ease: 'none', transformPerspective: 1200, scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left right', end: 'center center', scrub: true } });
  });
})();

/* ------------------------------------------------------------------
   Lightbox
------------------------------------------------------------------- */
const lb = $('#lightbox');
$$('[data-lightbox]').forEach((el) => el.addEventListener('click', () => {
  $('img', lb).src = el.dataset.lightbox;
  $('img', lb).alt = $('img', el)?.alt ?? '';
  lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
  lenis?.stop();
}));
function closeLb() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); lenis?.start(); }
lb.addEventListener('click', closeLb);
addEventListener('keydown', (e) => e.key === 'Escape' && closeLb());

/* ------------------------------------------------------------------
   Finale + downloads
------------------------------------------------------------------- */
gsap.from('.finale__sign', { opacity: 0, y: 40, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.finale__sign', start: 'top 90%', once: true } });
gsap.from('.downloads > *', { y: 30, opacity: 0, duration: 1, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.downloads', start: 'top 90%', once: true } });

// copiar SVG oficial (o download direto é bloqueado em alguns visualizadores)
$$('[data-copy-svg]').forEach((b) => b.addEventListener('click', async () => {
  const code = LOGOS[b.dataset.copySvg]().replace(/fill="currentColor"/g, 'fill="#193C30"');
  try { await navigator.clipboard.writeText(code); showToast(`<i style="background:#193C30"></i>SVG copiado: ${b.textContent.replace('Copiar SVG', '').trim()}`); }
  catch { showToast('Não foi possível copiar. Os arquivos estão em assets/brand no repositório.'); }
}));

/* ------------------------------------------------------------------
   Estúdio 3D (carregado sob demanda)
------------------------------------------------------------------- */
const studioSec = $('#estudio');
let studioApi = null; let studioLoading = false;
const io = new IntersectionObserver(async ([entry]) => {
  if (entry.isIntersecting && !studioApi && !studioLoading) {
    studioLoading = true;
    try {
      studioApi = await import('./studio3d.js').then((m) => m.initStudio($('#studioCanvas'), {
        onSelect: (i, caption) => {
          $$('.studio__tabs button').forEach((b, k) => b.classList.toggle('is-active', k === i));
          $('#studioCaption').innerHTML = `<b>${caption[0]}</b><span>${caption[1]}</span>`;
          gsap.fromTo('#studioCaption', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' });
        },
      }));
    } catch (err) { console.warn('Estúdio 3D indisponível:', err); studioSec.classList.add('studio--nogl'); }
  }
  studioApi?.setActive(entry.isIntersecting);
}, { rootMargin: '300px 0px' });
io.observe(studioSec);
$$('.studio__tabs button').forEach((b) => b.addEventListener('click', () => studioApi?.select(+b.dataset.item)));

// gatilhos criados antes das seções fixadas precisam ser reordenados
ScrollTrigger.sort();
ScrollTrigger.refresh();
addEventListener('load', () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
