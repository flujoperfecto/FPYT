import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { channelUrl, chapters } from './data.js';
import { api, copyText } from './api.js';
import Mark from './BrandMark.jsx';

const Arrow = ({ diagonal = false }) => <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>;

function PageEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      if (reducedMotion || pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        root.style.setProperty('--pointer-x', `${event.clientX}px`);
        root.style.setProperty('--pointer-y', `${event.clientY}px`);
        root.style.setProperty('--hero-x', `${((event.clientX / window.innerWidth) - .5) * 14}px`);
        root.style.setProperty('--hero-y', `${((event.clientY / window.innerHeight) - .5) * 10}px`);
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
    const observeNewElements = () => document.querySelectorAll('[data-reveal]:not(.reveal-ready)').forEach(reveal);
    const mutationObserver = new MutationObserver(observeNewElements);

    observeNewElements();
    updateScroll();
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    window.addEventListener('pointermove', updatePointer, { passive: true });
    return () => {
      observer.disconnect();
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
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
  return (
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Flujo Perfecto, inicio"><Mark /><strong>FLUJO PERFECTO</strong></a>
      <button className="menu-button" aria-expanded={open} aria-label="Abrir menú" onClick={() => setOpen(!open)}><span /><span /></button>
      <nav className={open ? 'nav open' : 'nav'} aria-label="Navegación principal">
        <a href="#biblioteca">Biblioteca</a>
        <a href="#aula">Aula</a>
        <a href="#metodo">Método</a>
        <a className="nav-cta" href={channelUrl} target="_blank" rel="noreferrer">YouTube <Arrow diagonal /></a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero shell" id="inicio">
      <div className="hero-copy reveal">
        <p className="eyebrow"><span /> APRENDE IA CONSTRUYENDO</p>
        <h1>Deja de mirar.<br /><em>Empieza a crear.</em></h1>
        <p className="hero-lede">Skills, prompts y sistemas para convertir tus ideas en apps, agentes y negocios digitales reales.</p>
        <div className="hero-actions">
          <a className="button primary" href="#biblioteca">Explorar la biblioteca <Arrow /></a>
          <a className="button ghost" href={channelUrl} target="_blank" rel="noreferrer">Ver en YouTube <Arrow diagonal /></a>
        </div>
        <div className="proof-row"><span>En español</span><span>Paso a paso</span><span>Listo para usar</span></div>
      </div>
      <div className="hero-art reveal delay" aria-label="Universo visual de Flujo Perfecto">
        <div className="art-label top">FLUJO / 001</div>
        <div className="art-label bottom">CONOCIMIENTO QUE SE EJECUTA</div>
        <div className="signal"><i /><span>SEÑAL ACTIVA</span></div>
      </div>
    </section>
  );
}

function Ticker() {
  const topics = ['CLAUDE CODE', 'PROMPTS', 'VIBE CODING', 'AGENTES DE IA', 'AUTOMATIZACIONES', 'NEGOCIOS DIGITALES'];
  return <div className="ticker" aria-label="Temas del canal"><div>{[...topics, ...topics].map((t, i) => <span key={`${t}-${i}`}>{t}<b>✦</b></span>)}</div></div>;
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

  return (
    <section className="library section" id="biblioteca">
      <div className="shell">
        <div className="section-heading" data-reveal>
          <p className="eyebrow"><span /> BIBLIOTECA ABIERTA</p>
          <h2>Encuentra. Adapta.<br /><em>Construye.</em></h2>
          <p>Cada video se convierte en una ruta de construcción con capítulos y materiales entregados en el momento preciso.</p>
        </div>
        <div className="library-tools" data-reveal>
          <label className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar un tutorial..." aria-label="Buscar tutoriales" /></label>
          <div className="library-promise"><span>VIDEO</span><span>CAPÍTULOS</span><span>MATERIALES</span><span>PROGRESO</span></div>
        </div>
        {error && <div className="empty-state" role="alert">No se pudieron cargar los tutoriales. <button className="text-button" onClick={load}>Reintentar</button></div>}
        {!error && <div className="result-count"><span>{String(visible.length).padStart(2, '0')}</span> TUTORIALES DISPONIBLES</div>}
        <div className="tutorial-grid">
          {!error && visible.map((video, index) => (
            <article className="tutorial-card" key={video.id} data-reveal>
              <a href={video.accessMode === 'public' ? `/hub/${video.slug}` : `/acceso/${video.slug}`} aria-label={`Abrir ${video.title}`}>
                <div className="tutorial-cover" style={{ backgroundImage: `linear-gradient(0deg, rgba(7,5,11,.9), transparent 62%), url('${video.coverUrl}')` }}><span>{String(index + 1).padStart(2, '0')}</span><b>VER RUTA DE CONSTRUCCIÓN</b></div>
                <div className="tutorial-body"><small>TUTORIAL · {video.accessMode === 'public' ? 'ACCESO DIRECTO' : 'MATERIAL GRATUITO'}</small><h3>{video.title}</h3><p>{video.description}</p><div><span>{video.chapters} momentos</span><span>{video.resources} materiales</span><b><Arrow /></b></div></div>
              </a>
            </article>
          ))}
        </div>
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
          <h2>El video te inspira.<br /><em>El aula te ayuda a hacerlo.</em></h2>
          <p>Cada capítulo conecta la explicación con el recurso exacto: prompts, instrucciones, skills y enlaces.</p>
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

function MethodIcon({ step }) {
  if (step === '01') return <div className="method-icon knowledge" aria-hidden="true"><svg viewBox="0 0 180 180"><circle className="icon-orbit" cx="90" cy="90" r="68" /><circle className="icon-dots" cx="90" cy="90" r="53" /><path className="icon-main" d="M39 90c14-22 31-33 51-33s37 11 51 33c-14 22-31 33-51 33S53 112 39 90Z" /><circle className="icon-core" cx="90" cy="90" r="17" /><path className="icon-detail" d="M90 73v34M73 90h34M59 47l8 10M121 47l-8 10M59 133l8-10M121 133l-8-10" /></svg><i /></div>;
  if (step === '02') return <div className="method-icon build" aria-hidden="true"><svg viewBox="0 0 180 180"><circle className="icon-orbit" cx="90" cy="90" r="68" /><path className="icon-main" d="M37 66 90 35l53 31H37Zm10 12h86M50 78v54M70 78v54M90 78v54M110 78v54M130 78v54M39 133h102M32 145h116" /><path className="icon-detail" d="M90 35v-16M90 19h24M42 106H27M138 106h15M27 106l-8 8M153 106l8 8" /><circle className="icon-core" cx="19" cy="114" r="4" /><circle className="icon-core" cx="161" cy="114" r="4" /></svg><i /></div>;
  return <div className="method-icon launch" aria-hidden="true"><svg viewBox="0 0 180 180"><circle className="icon-orbit" cx="90" cy="90" r="68" /><path className="icon-main" d="M49 137V88c0-30 17-51 41-51s41 21 41 51v49M65 137V91c0-20 10-34 25-34s25 14 25 34v46M39 137h102" /><path className="icon-detail" d="m73 111 40-40M86 71h27v27" /><path className="icon-flare" d="M90 154v-18M72 151l8-16M108 151l-8-16" /><circle className="icon-core" cx="90" cy="37" r="5" /></svg><i /></div>;
}

function Method() {
  const steps = [
    ['01', 'ΓΝΩΣΙΣ / GNOSIS', 'Entiende', 'El problema, la oportunidad y cada decisión explicados sin humo.'],
    ['02', 'ΠΟΙΗΣΙΣ / POIESIS', 'Construye', 'Usa el video y sus materiales para producir un resultado verificable.'],
    ['03', 'ΠΡΑΞΙΣ / PRAXIS', 'Lanza', 'Publica, mide una señal real y convierte lo aprendido en criterio propio.']
  ];
  return (
    <section className="method section" id="metodo">
      <div className="method-atmosphere" aria-hidden="true"><i /><i /><i /><span /></div>
      <div className="shell">
        <div className="method-head" data-reveal><p className="method-code">ΜΕΘΟΔΟΣ / SYSTEM 03</p><p className="eyebrow"><span /> EL MÉTODO FLUJO PERFECTO <span /></p><h2>Aprender es bueno.<br /><em>Publicar es mejor.</em></h2><div className="method-seal" aria-hidden="true">Φ</div></div>
        <div className="method-grid" data-reveal>{steps.map(([n, inscription, title, text]) => <article key={n}><header><span>{n}</span><small>{inscription}</small></header><MethodIcon step={n} /><div className="method-copy"><h3>{title}</h3><p>{text}</p></div><b aria-hidden="true">✦</b></article>)}</div>
      </div>
    </section>
  );
}

function FinalCta() {
  return <section className="final-cta"><div className="shell" data-reveal><p>LA PRÓXIMA IDEA NO SE CONSTRUYE SOLA</p><h2>No mires la revolución.<br /><em>Construye dentro de ella.</em></h2><a className="button light" href={channelUrl} target="_blank" rel="noreferrer">Unirme al canal <Arrow /></a></div></section>;
}

function Footer() {
  return <footer><div className="shell footer-grid"><a className="brand" href="#inicio"><Mark /><strong>FLUJO PERFECTO</strong></a><p>Apps, agentes y negocios digitales construidos con IA, paso a paso y en español.</p><div><a href="#biblioteca">Biblioteca</a><a href="#aula">Aula</a><a href={channelUrl}>YouTube ↗</a></div></div><div className="shell legal"><span>© 2026 FLUJO PERFECTO</span><span>CONSTRUYE CON IA</span></div></footer>;
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

export default function App() {
  const [selected, setSelected] = useState(null);
  return <><PageEffects /><Header /><main><Hero /><Ticker /><Library /><Classroom onOpen={setSelected} /><Method /><FinalCta /></main><Footer /><ResourceDrawer item={selected} onClose={() => setSelected(null)} /></>;
}
