import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { channelUrl, chapters } from './data.js';
import { api, copyText } from './api.js';
import Mark from './BrandMark.jsx';

const Arrow = ({ diagonal = false }) => <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>;

function PageEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = document.querySelector('.hero');
    let heroVisible = true;
    let scrollFrame = 0;
    let pointerFrame = 0;

    const updateScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        const maximum = document.documentElement.scrollHeight - window.innerHeight;
        root.style.setProperty('--scroll-progress', maximum > 0 ? String(window.scrollY / maximum) : '0');
        scrollFrame = 0;
      });
    };

    const updatePointer = event => {
      if (reducedMotion || pointerFrame || !heroVisible) return;
      pointerFrame = window.requestAnimationFrame(() => {
        const horizontal = (event.clientX / window.innerWidth) - .5;
        const vertical = (event.clientY / window.innerHeight) - .5;
        root.style.setProperty('--pointer-x', `${event.clientX}px`);
        root.style.setProperty('--pointer-y', `${event.clientY}px`);
        root.style.setProperty('--hero-bg-x', `${horizontal * 12}px`);
        root.style.setProperty('--hero-bg-y', `${vertical * 12}px`);
        root.style.setProperty('--hero-mid-x', `${horizontal * 24}px`);
        root.style.setProperty('--hero-mid-y', `${vertical * 24}px`);
        root.style.setProperty('--hero-front-x', `${horizontal * 36}px`);
        root.style.setProperty('--hero-front-y', `${vertical * 36}px`);
        pointerFrame = 0;
      });
    };

    const reveal = element => {
      element.classList.add('reveal-ready');
      if (reducedMotion) element.classList.add('is-visible');
      else observer.observe(element);
    };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -7%' });
    // Re-observe ready elements too: React StrictMode mounts effects twice in
    // development, so the first observer can be cleaned up while the class remains.
    const observeNewElements = () => document.querySelectorAll('[data-reveal]').forEach(reveal);
    const mutationObserver = new MutationObserver(observeNewElements);
    const heroObserver = new IntersectionObserver(([entry]) => { heroVisible = Boolean(entry?.isIntersecting); }, { threshold: 0 });

    observeNewElements();
    updateScroll();
    if (hero) heroObserver.observe(hero);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    window.addEventListener('pointermove', updatePointer, { passive: true });
    return () => {
      observer.disconnect();
      heroObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
      window.removeEventListener('pointermove', updatePointer);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    };
  }, []);

  return <div className="page-effects" aria-hidden="true"><i /><i /><span /></div>;
}

function Header() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    const onKey = event => { if (event.key === 'Escape') close(); };
    const onResize = () => { if (window.innerWidth > 680) close(); };
    window.addEventListener('hashchange', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.body.classList.toggle('nav-open', open);
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.classList.remove('nav-open');
    };
  }, [open]);
  return (
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Flujo Perfecto, inicio"><Mark /><strong>FLUJO PERFECTO</strong></a>
      <button className="menu-button" aria-controls="main-navigation" aria-expanded={open} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(!open)}><span /><span /></button>
      <nav id="main-navigation" className={open ? 'nav open' : 'nav'} aria-label="Navegación principal">
        <a href="#biblioteca">Biblioteca</a>
        <a href="#aula">Aula</a>
        <a href="#metodo">Método</a>
        <a className="nav-cta" href={channelUrl} target="_blank" rel="noreferrer">YouTube <Arrow diagonal /></a>
      </nav>
      {open && <button className="nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" tabIndex={-1} />}
    </header>
  );
}

function Hero() {
  return (
    <section className="hero shell" id="inicio">
      <div className="hero-copy reveal">
        <p className="eyebrow"><span /> APRENDE IA APLICADA</p>
        <h1>Deja de coleccionar herramientas.<br /><em>Empieza a diseñar sistemas.</em></h1>
        <p className="hero-lede">No aprendas IA para saber hablar de ella. Aprende IA para saber qué hacer con ella: sistemas que te quitan el trabajo repetitivo y siguen en pie cuando cambia la herramienta de moda.</p>
        <div className="hero-actions">
          <a className="button primary" href="#biblioteca">Explorar la biblioteca <Arrow /></a>
          <a className="button ghost" href={channelUrl} target="_blank" rel="noreferrer">Ver en YouTube <Arrow diagonal /></a>
        </div>
        <div className="proof-row"><span>En español</span><span>Paso a paso</span><span>Criterio, no trucos</span></div>
      </div>
      <div className="hero-art reveal delay" aria-hidden="true">
        <picture className="hero-visual">
          <source media="(max-width: 680px)" srcSet="/images/flujo-oracle-mobile.webp" />
          <img src="/images/flujo-oracle-desktop.webp" alt="" width="1920" height="1080" fetchPriority="high" />
        </picture>
        <div className="hero-geometry">
          <svg viewBox="0 0 900 900" focusable="false"><circle cx="540" cy="410" r="218" /><circle cx="540" cy="410" r="302" /><path d="M238 410h604M540 108v604M326 196l428 428M754 196 326 624" /><polygon points="540,153 767,540 313,540" /></svg>
        </div>
        <div className="hero-veil"><i /><i /><i /></div>
        <div className="art-label top">FLUJO / 001</div>
        <div className="art-label bottom">ORÁCULO VIVO / CONOCIMIENTO QUE SE EJECUTA</div>
        <div className="signal"><i /><span>SEÑAL ACTIVA</span></div>
      </div>
    </section>
  );
}

const taughtTechnologies = [
  ['OpenClaw', '/images/technologies/open-claw.png'], ['Antigravity', '/images/technologies/antigravity.png'],
  ['Claude', '/images/technologies/claude.png'], ['Codex', '/images/technologies/codex.png'],
  ['Gemini', '/images/technologies/gemini.png'], ['Hermes', '/images/technologies/hermes.png'],
  ['DeepSeek', '/images/technologies/deepseek.png'], ['Moonshot AI', '/images/technologies/moonshot-ai.png']
];

// A bolt is a straight segment broken by recursive midpoint displacement: each
// pass pushes every midpoint sideways, halving the offset, which is what gives
// lightning its self-similar jaggedness.
function forkedPath(x0, y0, x1, y1, amplitude) {
  let points = [[x0, y0], [x1, y1]];
  let amp = amplitude;
  for (let pass = 0; pass < 4; pass++) {
    const next = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const push = (Math.random() - 0.5) * amp;
      next.push([(ax + bx) / 2 - (dy / len) * push, (ay + by) / 2 + (dx / len) * push], points[i + 1]);
    }
    points = next;
    amp *= 0.55;
  }
  return points;
}

function traceBolt(ctx, points, width, colour, blur) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.shadowBlur = blur;
  ctx.shadowColor = 'rgba(150,80,255,.95)';
  ctx.stroke();
}

const IDLE_BOLTS = 3;
const IDLE_GAP = [130, 430];
const BOLT_LIFE = [150, 290];

function TechnologyRing({ technologies }) {
  const stageRef = useRef(null);
  const backRef = useRef(null);
  const frontRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    const layers = [backRef.current, frontRef.current];
    if (!stage || layers.some((c) => !c)) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ctx = layers.map((c) => c.getContext('2d'));
    const pointer = { x: 0, y: 0, live: false };
    let bolts = [];
    let frame = 0;
    let onScreen = true;
    let width = 0;
    let height = 0;
    let nextStrike = 0;

    const resize = () => {
      const box = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      layers.forEach((c, i) => {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
        ctx[i].setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx[i].lineCap = 'round';
        ctx[i].lineJoin = 'round';
      });
    };

    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      // Every layout read happens here, before any drawing, so the frame costs
      // one style flush rather than one per element.
      const stageBox = stage.getBoundingClientRect();
      const coreEl = stage.querySelector('.technology-core-face');
      const coreBox = coreEl?.getBoundingClientRect();
      const logos = [...stage.querySelectorAll('.technology-logo')].map((el) => el.getBoundingClientRect());
      if (!coreBox || !logos.length) return;

      const core = { x: coreBox.left + coreBox.width / 2 - stageBox.left, y: coreBox.top + coreBox.height / 2 - stageBox.top, r: coreBox.width / 2 };
      const spans = logos.map((r) => r.width);
      const mid = (Math.min(...spans) + Math.max(...spans)) / 2;
      const targets = logos.map((r) => ({
        x: r.left + r.width / 2 - stageBox.left,
        y: r.top + r.height / 2 - stageBox.top,
        r: r.width / 2,
        front: r.width >= mid   // a wider card is nearer the camera
      }));

      let attracted = -1;
      if (pointer.live) {
        let best = Infinity;
        targets.forEach((t, i) => {
          const d = Math.hypot(t.x - pointer.x, t.y - pointer.y);
          if (d < best) { best = d; attracted = i; }
        });
      }

      if (now >= nextStrike && bolts.length < IDLE_BOLTS) {
        bolts.push({ target: Math.floor(Math.random() * targets.length), born: now, life: BOLT_LIFE[0] + Math.random() * (BOLT_LIFE[1] - BOLT_LIFE[0]), power: 0.5 });
        nextStrike = now + IDLE_GAP[0] + Math.random() * (IDLE_GAP[1] - IDLE_GAP[0]);
      }
      if (attracted >= 0 && !bolts.some((b) => b.sustained)) bolts.push({ target: attracted, born: now, life: Infinity, power: 1, sustained: true });
      bolts.forEach((b) => { if (b.sustained) { b.target = attracted; b.power = 1; } });
      bolts = bolts.filter((b) => (b.sustained ? attracted >= 0 : now - b.born < b.life));

      ctx.forEach((c) => c.clearRect(0, 0, width, height));
      let idleGlow = 0;
      let strikeGlow = 0;
      for (const bolt of bolts) {
        const t = targets[bolt.target];
        if (!t) continue;
        const dx = t.x - core.x, dy = t.y - core.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const x0 = core.x + ux * core.r * 0.9;
        const y0 = core.y + uy * core.r * 0.9;
        const x1 = t.x - ux * t.r * 1.02;   // stop at the logo's edge, never across it
        const y1 = t.y - uy * t.r * 1.02;
        const span = Math.hypot(x1 - x0, y1 - y0);
        const age = bolt.sustained ? 1 : Math.sin(Math.PI * ((now - bolt.born) / bolt.life));
        const alpha = Math.max(0, age) * (0.65 + Math.random() * 0.35) * bolt.power;
        if (alpha <= 0.02) continue;
        if (bolt.sustained) strikeGlow += alpha; else idleGlow += alpha;
        const layer = ctx[t.front ? 1 : 0];
        const path = forkedPath(x0, y0, x1, y1, span * 0.14);
        traceBolt(layer, path, 3.4 * bolt.power, `rgba(150,80,255,${alpha * 0.55})`, 18);
        traceBolt(layer, path, 1.3, `rgba(255,255,255,${alpha})`, 7);
        if (Math.random() < 0.45) {
          const at = path[Math.floor(path.length * (0.35 + Math.random() * 0.4))];
          const spread = (Math.random() - 0.5) * 1.4;
          const reach = span * (0.18 + Math.random() * 0.18);
          traceBolt(layer, forkedPath(at[0], at[1], at[0] + (ux * Math.cos(spread) - uy * Math.sin(spread)) * reach, at[1] + (ux * Math.sin(spread) + uy * Math.cos(spread)) * reach, reach * 0.3), 1, `rgba(214,186,255,${alpha * 0.7})`, 6);
        }
      }
      ctx.forEach((c) => { c.shadowBlur = 0; });
      // The core lights up because it is firing, not on a timer of its own.
      // Written after every read in the frame, so it never forces a reflow.
      // Idle discharges only ripple the core; a pointer strike is what really
      // lights it. Keeping the two apart stops the effect saturating at rest.
      setCharge(coreEl, Math.min(1, idleGlow * 0.2 + strikeGlow * 0.85));
    };

    let lastCharge = -1;
    const setCharge = (el, value) => {
      const q = Math.round(value * 20) / 20;
      if (q === lastCharge || !el) return;
      lastCharge = q;
      el.style.setProperty('--charge', String(q));
    };

    const start = () => { if (!frame && onScreen && !reduced.matches) frame = requestAnimationFrame(draw); };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      bolts = [];
      ctx.forEach((c) => c.clearRect(0, 0, width, height));
      setCharge(stage.querySelector('.technology-core-face'), 0);
    };

    const track = (e) => {
      const box = stage.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    };
    // Mouse reacts to hover; touch and pen only while pressed, so the ring never
    // competes with scrolling. No preventDefault anywhere.
    const onMove = (e) => { if (e.pointerType === 'mouse' || pointer.live) track(e); if (e.pointerType === 'mouse') pointer.live = true; };
    const onLeave = (e) => { if (e.pointerType === 'mouse') pointer.live = false; };
    const onDown = (e) => { if (e.pointerType !== 'mouse') { track(e); pointer.live = true; } };
    const onUp = (e) => { if (e.pointerType !== 'mouse') pointer.live = false; };

    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave, { passive: true });
    stage.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) start(); else stop(); });
    io.observe(stage);
    const onScheme = () => (reduced.matches ? stop() : start());
    reduced.addEventListener('change', onScheme);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      reduced.removeEventListener('change', onScheme);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className="technology-stage" ref={stageRef}>
      <canvas className="technology-arcs is-back" ref={backRef} aria-hidden="true" />
      <ul className="technology-ring" role="list"><li className="technology-core" aria-hidden="true"><div className="technology-core-face"><span className="technology-core-seal">Φ</span><span className="technology-core-label">EL SISTEMA</span></div></li>{technologies.map(([name, src], index) => <li className="technology-slot" key={name} style={{ '--i': index }}><div className="technology-billboard"><div className="technology-card"><span className="technology-index">{String(index + 1).padStart(2, '0')}</span><img className="technology-logo" src={src} alt={name} width="76" height="76" decoding="async" /><span className="technology-name">{name}</span></div></div></li>)}</ul>
      <canvas className="technology-arcs is-front" ref={frontRef} aria-hidden="true" />
    </div>
  );
}

function TechnologyStrip() {
  return <section className="technologies" aria-labelledby="technologies-title"><div className="shell technologies-inner" data-reveal>
    <div className="technologies-heading"><p className="eyebrow"><span /> LAS HERRAMIENTAS ORBITAN</p><p id="technologies-title">Cambian cada mes y da igual: lo que permanece es el sistema que decide cuál usar, cuándo y para qué.</p></div>
    <TechnologyRing technologies={taughtTechnologies} />
  </div></section>;
}

const fallbackTopics = ['CLAUDE CODE', 'PROMPTS', 'VIBE CODING', 'AGENTES DE IA', 'AUTOMATIZACIONES', 'NEGOCIOS DIGITALES'];

function formatEditionDate(value) {
  if (!value) return 'RESERVA EDITORIAL';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)).replace('.', '').toUpperCase();
}

function categoryLabel(value = '') {
  return ({ automatizacion: 'AUTOMATIZACIÓN', investigacion: 'INVESTIGACIÓN' }[value] || value).toUpperCase();
}

function AiNewsTicker({ onOpen }) {
  const [edition, setEdition] = useState(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;
    api('/api/news').then(result => { if (active) setEdition(result); }).catch(() => { if (active) setEdition(null); });
    return () => { active = false; };
  }, []);

  const isFresh = Boolean(edition?.items?.length === 4 && Date.now() - Date.parse(edition.publishedAt) <= 72 * 60 * 60 * 1000);
  const items = isFresh ? edition.items : fallbackTopics.map((headline, index) => ({ id: `fallback-${index}`, headline, fallback: true }));
  const date = isFresh ? formatEditionDate(edition.editionDate) : 'RESERVA EDITORIAL';

  const renderItem = (item, clone = false) => {
    const content = <><span className="news-category">{item.fallback ? 'TEMA' : categoryLabel(item.category)}</span><strong>{item.headline}</strong>{!item.fallback && <small>{item.primarySource.name}</small>}<b aria-hidden="true">✦</b></>;
    if (clone || item.fallback) return <span className="news-ticker-item" key={`${clone ? 'clone' : 'fallback'}-${item.id}`}>{content}</span>;
    return <button className="news-ticker-item" key={item.id} onClick={() => onOpen(item)} aria-label={`Abrir noticia: ${item.headline}`}>{content}</button>;
  };

  return <section className={`ai-news-ticker${paused ? ' is-paused' : ''}`} aria-label="Pulso IA, noticias destacadas del día">
    <div className="news-ticker-head"><span><i className={isFresh ? 'is-live' : ''} /> PULSO IA</span><time dateTime={isFresh ? edition.editionDate : undefined}>{date}</time><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Reanudar' : 'Pausar'} <b aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</b></button></div>
    <div className="news-ticker-lane">
      <div className="news-ticker-track">
        <div className="news-ticker-group" role="list">{items.map(item => <div role="listitem" key={item.id}>{renderItem(item)}</div>)}</div>
        <div className="news-ticker-group news-ticker-clone" aria-hidden="true">{items.map(item => <div key={item.id}>{renderItem(item, true)}</div>)}</div>
      </div>
    </div>
  </section>;
}

function Library() {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true); setError('');
    api('/api/videos').then(data => { setVideos(data); }).catch(errorValue => { setError(errorValue.message); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => videos.filter(video => `${video.title} ${video.description}`.toLowerCase().includes(query.toLowerCase())), [videos, query]);
  const showCatalogTools = videos.length > 1;

  const cards = !error && visible.map((video, index) => (
    <article className="tutorial-card" key={video.id} data-reveal>
      <a href={video.accessMode === 'public' ? `/hub/${video.slug}` : `/acceso/${video.slug}`} aria-label={`Abrir ${video.title}`}>
        <div className="tutorial-cover" style={{ backgroundImage: `linear-gradient(0deg, rgba(7,5,11,.9), transparent 62%), url('${video.coverUrl}')` }}><span>{String(index + 1).padStart(2, '0')}</span><b>VER RUTA DE CONSTRUCCIÓN</b></div>
        <div className="tutorial-body"><small>TUTORIAL · {video.accessMode === 'public' ? 'ACCESO DIRECTO' : 'MATERIAL GRATUITO'}</small><h3>{video.title}</h3><p>{video.description}</p><div><span>{video.chapters} momentos</span><span>{video.resources} materiales</span><b><Arrow /></b></div></div>
      </a>
    </article>
  ));

  return (
    <section className="library section" id="biblioteca">
      <div className="shell">
        <div className="section-heading" data-reveal>
          <p className="eyebrow"><span /> BIBLIOTECA ABIERTA</p>
          <h2>Encuentra. Adapta.<br /><em>Ponlo a trabajar.</em></h2>
          <p>Cada video se convierte en un sistema que puedes operar: capítulos, decisiones y materiales entregados en el momento exacto.</p>
        </div>
        {showCatalogTools && <div className="library-tools" data-reveal>
          <label className="search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar un tutorial..." aria-label="Buscar tutoriales" /></label>
          <div className="library-promise" aria-label="Todos los tutoriales incluyen video, capítulos, materiales y progreso"><span>VIDEO</span><span>CAPÍTULOS</span><span>MATERIALES</span><span>PROGRESO</span></div>
        </div>}
        {error && <div className="empty-state" role="alert">No se pudieron cargar los tutoriales. <button className="text-button" onClick={load}>Reintentar</button></div>}
        {!error && !loading && <div className={showCatalogTools ? 'result-count' : 'featured-route-label'} aria-live="polite"><span>{showCatalogTools ? String(visible.length).padStart(2, '0') : 'RUTA 01'}</span> {showCatalogTools ? 'TUTORIALES DISPONIBLES' : 'EMPIEZA POR AQUÍ'}</div>}
        {!error && (loading ? <div className="tutorial-grid" aria-label="Cargando tutoriales" aria-busy="true"><article className="tutorial-card tutorial-skeleton"><div /><div><i /><i /><i /></div></article></div> : <div className="tutorial-grid">{cards}</div>)}
        {!error && !loading && !visible.length && <div className="empty-state">No hay tutoriales publicados con esa búsqueda.</div>}
      </div>
    </section>
  );
}

function Classroom({ onOpen }) {
  const [active, setActive] = useState(0);
  const chapter = chapters[active];
  return (
    <section className="classroom section" id="aula">
      <div className="shell">
        <div className="classroom-intro" data-reveal>
          <p className="eyebrow"><span /> NO ES OTRO VIDEO MÁS</p>
          <h2>Ver no es saber.<br /><em>El aula te hace ejecutar.</em></h2>
          <p>Cada capítulo conecta la decisión con el material exacto: prompts, instrucciones, skills y enlaces. Nada suelto.</p>
        </div>
        <div className="classroom-frame" data-reveal>
          <div className="video-stage">
            <div className="video-top"><span>DE IDEA A PRODUCTO CON IA</span><small>CLASE / 001</small></div>
            <div className="play-button" aria-hidden="true">▶</div>
            <div className="video-title">{chapter.title}</div>
            <div className="video-progress"><i style={{width: `${20 + active * 22}%`}} /></div>
            <div className="video-time">{chapter.time} <span>/ 42:16</span></div>
          </div>
          <div className="chapter-panel">
            <div className="panel-title"><span>CAPÍTULOS</span><small>{active + 1} / {chapters.length}</small></div>
            <div className="chapter-list">{chapters.map((item, index) => (
              <button key={item.time} className={active === index ? 'active' : ''} onClick={() => setActive(index)}>
                <span>{item.time}</span><strong>{item.title}</strong><i>↗</i>
              </button>
            ))}</div>
          </div>
          <div className="chapter-detail">
            <div><small>EN ESTE MOMENTO</small><h3>{chapter.title}</h3><p>{chapter.description}</p></div>
            <button className="attached-resource" onClick={() => onOpen(chapter.resource)}><span>{chapter.resource.type}</span><strong>{chapter.resource.title}</strong><b>Abrir <Arrow /></b></button>
          </div>
        </div>
      </div>
    </section>
  );
}

const methodVisuals = {
  '01': { name: 'understand', src: '/images/method-understand.webp' },
  '02': { name: 'build', src: '/images/method-build.webp' },
  '03': { name: 'launch', src: '/images/method-launch.webp' }
};

function MethodVisual({ step }) {
  const visual = methodVisuals[step];
  return (
    <div className={`method-visual method-visual-${visual.name}`} aria-hidden="true">
      <img src={visual.src} alt="" loading="lazy" decoding="async" />
      <i className="method-visual-glow" />
      <i className="method-visual-sweep" />
    </div>
  );
}

function Method() {
  const steps = [
    ['01', 'ΓΝΩΣΙΣ / GNOSIS', 'Observa', 'El proceso real, la fricción y dónde se te va el tiempo. Antes de tocar ninguna herramienta.'],
    ['02', 'ΠΟΙΗΣΙΣ / POIESIS', 'Diseña', 'El sistema completo: entradas, decisiones, dónde entra la IA y dónde no.'],
    ['03', 'ΠΡΑΞΙΣ / PRAXIS', 'Opera', 'Lo pones a correr, mides una señal real y lo afinas hasta que trabaja sin ti.']
  ];
  return (
    <section className="method section" id="metodo">
      <div className="method-atmosphere" aria-hidden="true"><i /><i /><i /><span /></div>
      <div className="shell">
        <div className="method-head" data-reveal><p className="method-code">ΜΕΘΟΔΟΣ / SYSTEM 03</p><p className="eyebrow"><span /> EL MÉTODO FLUJO PERFECTO <span /></p><h2>Aprender es bueno.<br /><em>Que funcione solo es mejor.</em></h2><div className="method-seal" aria-hidden="true">Φ</div></div>
        <div className="method-grid" data-reveal>{steps.map(([n, inscription, title, text]) => <article key={n}><header><span>{n}</span><small>{inscription}</small></header><MethodVisual step={n} /><div className="method-copy"><h3>{title}</h3><p>{text}</p></div><b aria-hidden="true">✦</b></article>)}</div>
      </div>
    </section>
  );
}

function FinalCta() {
  return <section className="final-cta"><div className="cta-portal" aria-hidden="true"><i /><i /><i /><Mark /></div><div className="shell" data-reveal><p>LA IA NO TE VA A ESPERAR</p><h2>La IA no reemplaza personas.<br /><em>Reemplaza a quien no sabe usarla.</em></h2><a className="button light" href={channelUrl} target="_blank" rel="noreferrer">Unirme al canal <Arrow /></a></div></section>;
}

function Footer() {
  return <footer><div className="shell footer-grid"><a className="brand" href="#inicio"><Mark /><strong>FLUJO PERFECTO</strong></a><p>Sistemas con IA que eliminan el trabajo repetitivo. En español y paso a paso.</p><div><a href="#biblioteca">Biblioteca</a><a href="#aula">Aula</a><a href={channelUrl}>YouTube ↗</a></div></div><div className="shell legal"><span>© {new Date().getFullYear()} FLUJO PERFECTO</span><span>DISEÑA SISTEMAS</span></div></footer>;
}

function ResourceDrawer({ item, onClose }) {
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  useEffect(() => {
    if (!item) return;
    const previousFocus = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = event => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [item, onClose]);
  if (!item) return null;
  const canCopy = ['Prompt', 'Skill', 'Instrucción'].includes(item.type);
  const copy = async () => {
    await copyText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return <div className="drawer-wrap">
    <button className="drawer-scrim" onClick={onClose} aria-label="Cerrar recurso" tabIndex={-1} />
    <aside className="drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="resource-drawer-title">
      <div className="drawer-head"><span className="type">{item.type}</span><button ref={closeButtonRef} onClick={onClose} aria-label="Cerrar">×</button></div>
      <small>{item.tag} / {item.meta}</small><h2 id="resource-drawer-title">{item.title}</h2><p className="drawer-description">{item.description}</p>
      <div className="content-label"><span>CONTENIDO</span>{canCopy && <button onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar todo'} </button>}</div>
      <pre>{item.content}</pre>
      <div className="drawer-note"><Mark /><p>Adáptalo a tu contexto. El criterio siempre vale más que copiar sin entender.</p></div>
    </aside>
  </div>;
}

function NewsDrawer({ item, onClose }) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  useEffect(() => {
    if (!item) return;
    const previousFocus = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = event => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [item, onClose]);
  if (!item) return null;
  const sources = item.sources?.length ? item.sources : [item.primarySource];
  return <div className="drawer-wrap news-drawer-wrap">
    <button className="drawer-scrim" onClick={onClose} aria-label="Cerrar noticia" tabIndex={-1} />
    <aside className="drawer news-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="news-drawer-title">
      <div className="drawer-head"><span className="type">PULSO IA / {categoryLabel(item.category)}</span><button ref={closeButtonRef} onClick={onClose} aria-label="Cerrar">×</button></div>
      <small>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(item.primarySource.publishedAt))}</small>
      <h2 id="news-drawer-title">{item.headline}</h2>
      <p className="news-summary">{item.summary}</p>
      <section className="news-why"><span>POR QUÉ IMPORTA</span><p>{item.whyItMatters}</p></section>
      <div className="news-sources"><span>FUENTES</span>{sources.map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}><i>{String(index + 1).padStart(2, '0')}</i><strong>{source.name}</strong><small>{source.title || 'Abrir publicación original'}</small><b aria-hidden="true">↗</b></a>)}</div>
      <p className="news-disclaimer">Síntesis editorial generada a partir de las fuentes enlazadas. Revisa la publicación original antes de tomar decisiones críticas.</p>
    </aside>
  </div>;
}

export default function App() {
  const [selected, setSelected] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  useEffect(() => { document.title = 'Flujo Perfecto — Diseña sistemas con IA que trabajan por ti'; }, []);
  return <><a className="skip-link" href="#contenido">Saltar al contenido</a><PageEffects /><Header /><main id="contenido"><Hero /><TechnologyStrip /><Library /><AiNewsTicker onOpen={setSelectedNews} /><Classroom onOpen={setSelected} /><Method /><FinalCta /></main><Footer /><ResourceDrawer item={selected} onClose={() => setSelected(null)} /><NewsDrawer item={selectedNews} onClose={() => setSelectedNews(null)} /></>;
}
