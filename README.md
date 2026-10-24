# Alta Vista Residence: apresentação interativa da marca

Site de apresentação da identidade visual do **Alta Vista Residence**, construído a partir do *Guia de Identidade Visual, edição 01 (outubro 2026)*.

## Como abrir

O site usa módulos ES, por isso precisa ser servido por HTTP. Abrir o `index.html` direto do disco não funciona.

```bash
npx serve .            # ou: python3 -m http.server 8080
```

Funciona como site estático em qualquer hospedagem (GitHub Pages, Netlify, Vercel). Não há etapa de build: todas as bibliotecas ficam em `assets/vendor/` e o site funciona offline. A única exceção são as fontes do Google Fonts.

## O que tem na página

| Seção | Interação |
|---|---|
| Abertura | O símbolo se desenha traço a traço e ganha o preenchimento dourado |
| Hero 3D | O símbolo fica em camadas douradas (uma por contorno) com luz que segue o mouse, *bloom*, partículas com profundidade de campo (bokeh) e parallax. Clicar no símbolo dispara uma onda que sai do lago para as margens. Ao rolar, as camadas se abrem como um relevo topográfico |
| Essência / Nome | Títulos revelados palavra por palavra, cartões com *tilt* 3D e brilho, palavras gigantes em paralaxe, ícones que se desenham no hover |
| Construção do símbolo | Narrativa fixa na rolagem a partir do lago preservado no centro do terreno: a água, as margens, a vida ao redor, o selo e o nome |
| Versões | Troca entre vertical, horizontal e símbolo, área de proteção (x = ¼ do símbolo) no hover e controle de redução com os tamanhos mínimos do guia |
| Fundos / usos incorretos | Prévia das 4 combinações de fundo com luz que acompanha o mouse. Cartões viram para mostrar o uso correto |
| Paleta | Faixas que expandem no hover (com reflexo metálico nos dourados) e copiam o HEX no clique |
| Tipografia | Teste de fonte editável (Marcellus / DM Sans), controle de tamanho e hierarquia |
| AVRA | Seção "Um empreendimento da AVRA Incorporadora" e endosso secundário no hero e no fechamento |
| Estúdio 3D | Mockups refeitos em WebGL a partir dos mockups aprovados: **totem de entrada** (anoitece com luz de chão), **recepção do pavilhão** (halo retroiluminado), **kit de apresentação** com endosso AVRA (a tampa abre), **caderno Mata** com foil (abre), **crachá** com endosso AVRA (balança e gira) e **chaveiro** dourado (gira e salta). Dá para arrastar e clicar em todos |
| Tapume 3D | Os painéis da campanha se abrem como dominó durante a rolagem |
| Instagram / stories | Tablet e celular em CSS 3D que reagem ao mouse |
| Galeria | Os mockups do guia em rolagem horizontal com paralaxe interna e *lightbox* |
| Arquivos | Botões que copiam o SVG oficial do logo (vertical, horizontal, símbolo) e do P01; os arquivos ficam em `assets/brand/` |

A página respeita `prefers-reduced-motion`, que desativa a rolagem suave e as animações longas.

## Estrutura

```
index.html
assets/
  brand/      logo-vertical.svg, logo-horizontal.svg, symbol.svg, lettering.svg, residence.svg, p01.svg
  img/        fotos e mockups extraídos do guia (WebP)
  css/        style.css: tokens de cor e tipografia do guia
  js/
    brand-paths.js   vetores oficiais (extraídos do PDF)
    main.js          rolagem, animações e interações
    hero3d.js        símbolo 3D do hero (Three.js)
    studio3d.js      estúdio de mockups 3D (Three.js)
  vendor/     three.js r170, GSAP 3.12 + ScrollTrigger, Lenis 1.1
```

## Fidelidade à marca

- O símbolo, o lettering "ALTA VISTA" e o descritor "RESIDENCE" foram **extraídos como vetores do próprio PDF**. Nenhuma fonte substitui o lettering.
- Só são usadas as 7 cores da paleta (Mata, Floresta, Oliva, Sálvia, Dourado, Dourado claro, Mineral). Os degradês misturam apenas essas cores.
- Marcellus para títulos e DM Sans (400/600) para textos.
- O P01 nunca aparece sobre a assinatura.
- As imagens e os mockups fotográficos são os do guia: ilustrativos, gerados por IA, sem representar a implantação real.
