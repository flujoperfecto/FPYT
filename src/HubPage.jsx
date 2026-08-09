import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RESOURCE_LABELS, api, copyText, downloadResource, formatTime, youtubeId } from './api.js';
import Mark from './BrandMark.jsx';
import usePageMeta from './usePageMeta.js';

let youtubeApiPromise;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('YouTube tardó demasiado en responder.')), 12000);
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      window.clearTimeout(timeout);
      resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('No se pudo cargar el reproductor interactivo.'));
      };
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

function YouTubePlayer({ videoId, title, startSeconds, onPlayerReady, onTimeUpdate }) {
  const mountRef = useRef(null);
  const readyCallbackRef = useRef(onPlayerReady);
  const timeCallbackRef = useRef(onTimeUpdate);
  const [fallback, setFallback] = useState(false);

  useEffect(() => { readyCallbackRef.current = onPlayerReady; }, [onPlayerReady]);
  useEffect(() => { timeCallbackRef.current = onTimeUpdate; }, [onTimeUpdate]);

  useEffect(() => {
    let cancelled = false;
    let player;
    let interval;
    setFallback(false);
    loadYouTubeApi().then(YT => {
      if (cancelled || !mountRef.current) return;
      player = new YT.Player(mountRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { start: startSeconds, rel: 0, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: event => {
            event.target.getIframe()?.setAttribute('title', title);
            readyCallbackRef.current?.(event.target);
            interval = window.setInterval(() => {
              if (event.target.getPlayerState?.() === YT.PlayerState.PLAYING) timeCallbackRef.current?.(event.target.getCurrentTime());
            }, 700);
          },
          onStateChange: event => {
            if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) timeCallbackRef.current?.(event.target.getCurrentTime());
          }
        }
      });
    }).catch(() => { if (!cancelled) setFallback(true); });
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      readyCallbackRef.current?.(null);
      try { player?.destroy(); } catch { /* El iframe puede haber terminado de desmontarse. */ }
    };
  // El momento activo cambia mientras el video avanza; recrear el player aquí
  // interrumpiría la reproducción. Los saltos manuales se resuelven con seekTo.
  }, [videoId]);

  if (fallback) return <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${startSeconds}&rel=0&playsinline=1`} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;
  return <div className="youtube-player-mount"><div ref={mountRef} /></div>;
}

function HubResource({ item }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const readable = ['prompt', 'instruction', 'skill'].includes(item.type);
  const copy = async () => { await copyText(item.content); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const download = async () => {
    setDownloading(true); setDownloadError('');
    try { await downloadResource(item); }
    catch (errorValue) { setDownloadError(errorValue.message); }
    finally { setDownloading(false); }
  };
  return <article className={expanded ? 'hub-resource expanded' : 'hub-resource'}>
    <span>{RESOURCE_LABELS[item.type] || item.type}</span><div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div>
    {readable && <div className="hub-resource-actions"><button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Ocultar' : 'Ver contenido'}</button><button className="copy-resource" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar'}</button></div>}
    {item.type === 'link' && <a href={item.url} target="_blank" rel="noreferrer">Abrir ↗</a>}
    {item.type === 'file' && <button onClick={download} disabled={downloading}>{downloading ? 'Preparando…' : 'Descargar ↓'}</button>}
    {downloadError && <p className="resource-error" role="alert">{downloadError}</p>}
    {expanded && <div className="hub-resource-preview"><div><span>LISTO PARA USAR</span><button onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar todo'}</button></div><pre>{item.content}</pre><p>Adáptalo a tu contexto. Entender la intención del recurso produce mejores resultados que copiarlo sin cambios.</p></div>}
  </article>;
}

export default function HubPage({ slug, preview = false }) {
  const [video, setVideo] = useState(null);
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [error, setError] = useState('');
  const [resumeNotice, setResumeNotice] = useState(null);
  const [resourceCue, setResourceCue] = useState(null);
  const playerRef = useRef(null);
  const activeRef = useRef(0);
  const cueTimerRef = useRef(0);
  const timelineRef = useRef(null);

  usePageMeta({
    title: video?.title,
    description: video ? `${video.title}: aula interactiva con línea de tiempo, prompts y materiales, capítulo a capítulo.` : undefined,
    path: `/hub/${slug}`,
    noindex: preview,
  });

  useEffect(() => {
    api(preview ? `/api/admin/preview/${slug}` : `/api/hub/${slug}`).then(data => {
      setVideo(data);
      let stored = [];
      try { stored = JSON.parse(localStorage.getItem(`fp-progress-${data.id}`) || '[]'); }
      catch { stored = []; }
      const chapterIds = new Set(data.chapters.map(item => item.id));
      const validCompleted = [...new Set(Array.isArray(stored) ? stored : [])].filter(id => chapterIds.has(id));
      const firstIncomplete = data.chapters.findIndex(item => !validCompleted.includes(item.id));
      const resumeIndex = validCompleted.length ? (firstIncomplete >= 0 ? firstIncomplete : Math.max(0, data.chapters.length - 1)) : 0;
      setCompleted(validCompleted);
      setActive(resumeIndex);
      activeRef.current = resumeIndex;
      if (validCompleted.length && firstIncomplete >= 0) setResumeNotice({ index: resumeIndex, title: data.chapters[resumeIndex]?.title });
    }).catch(errorValue => {
      if (errorValue.status === 401) window.location.assign(errorValue.data.redirect);
      else setError(errorValue.message);
    });
  }, [preview, slug]);

  useEffect(() => {
    const item = timelineRef.current?.querySelector(`[data-chapter-index="${active}"]`);
    item?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }, [active]);

  useEffect(() => () => window.clearTimeout(cueTimerRef.current), []);

  const chapter = video?.chapters?.[active];
  const videoId = youtubeId(video?.youtubeUrl);
  const progress = useMemo(() => video?.chapters?.length ? Math.min(100, Math.round((completed.length / video.chapters.length) * 100)) : 0, [completed, video]);
  const toggleComplete = () => {
    const next = completed.includes(chapter.id) ? completed.filter(id => id !== chapter.id) : [...completed, chapter.id];
    setCompleted(next); localStorage.setItem(`fp-progress-${video.id}`, JSON.stringify(next));
  };
  const goTo = index => {
    const next = Math.max(0, Math.min(video.chapters.length - 1, index));
    activeRef.current = next;
    setActive(next);
    setResumeNotice(null);
    playerRef.current?.seekTo(video.chapters[next].startSeconds, true);
  };

  const onTimeUpdate = useCallback(seconds => {
    if (!video?.chapters?.length || !Number.isFinite(seconds)) return;
    let next = 0;
    video.chapters.forEach((item, index) => { if (item.startSeconds <= seconds) next = index; });
    if (next === activeRef.current) return;
    activeRef.current = next;
    setActive(next);
    setResumeNotice(null);
    const item = video.chapters[next];
    setResourceCue({ title: item.title, count: item.resources.length });
    window.clearTimeout(cueTimerRef.current);
    cueTimerRef.current = window.setTimeout(() => setResourceCue(null), 4200);
  }, [video]);

  if (error) return <div className="portal-status">{error}</div>;
  if (!video) return <div className="portal-status">Preparando el aula…</div>;
  if (!chapter) return <div className="portal-status">Este tutorial aún no tiene momentos publicados.</div>;

  return <main className="hub-page">
    {preview && <div className="preview-banner"><strong>Vista previa del administrador</strong><span>Este contenido todavía puede estar oculto para tus suscriptores.</span><a href="/admin">Volver al panel</a></div>}
    <header className="hub-header"><a className="brand" href="/"><Mark /><strong>FLUJO PERFECTO</strong></a><div className="hub-progress" aria-label={`${completed.length} de ${video.chapters.length} momentos completados`}><span><i style={{ width: `${progress}%` }} /></span><b><em>{completed.length}/{video.chapters.length}</em> · {progress}% completado</b></div><a href={video.youtubeUrl || '#'} target="_blank" rel="noreferrer">Ver en YouTube ↗</a></header>
    <div className="hub-title"><p>TUTORIAL / AULA INTERACTIVA</p><h1>{video.title}</h1></div>
    {resumeNotice && <aside className="resume-notice"><div><span>CONTINÚA DONDE QUEDASTE</span><strong>Momento {String(resumeNotice.index + 1).padStart(2, '0')} · {resumeNotice.title}</strong></div><a href="#ruta-activa">Seguir construyendo →</a><button onClick={() => setResumeNotice(null)} aria-label="Cerrar aviso de reanudación">×</button></aside>}
    <section className="hub-workspace" id="ruta-activa">
      <aside className="timeline" ref={timelineRef}><div className="timeline-head"><span>LÍNEA DE TIEMPO</span><b>{video.chapters.length} momentos</b></div>{video.chapters.map((item, index) => <button data-chapter-index={index} key={item.id} className={index === active ? 'active' : ''} aria-current={index === active ? 'step' : undefined} onClick={() => goTo(index)}><i className={completed.includes(item.id) ? 'done' : ''} /><span>{formatTime(item.startSeconds)}</span><strong>{item.title}</strong><small>{item.resources.length} {item.resources.length === 1 ? 'recurso' : 'recursos'}</small></button>)}</aside>
      <div className="hub-main">
        <div className="hub-player">
          {videoId ? <YouTubePlayer videoId={videoId} title={video.title} startSeconds={chapter.startSeconds} onPlayerReady={player => { playerRef.current = player; }} onTimeUpdate={onTimeUpdate} /> : <div className="player-poster" style={{ backgroundImage: `url('${video.coverUrl || '/images/flujo-classroom.webp'}')` }}><span>▶</span><p>Agrega la URL de YouTube desde el panel administrador</p></div>}
          {resourceCue && <div className="resource-cue" role="status" aria-live="polite"><i /> <span><small>NUEVO MOMENTO ACTIVO</small><strong>{resourceCue.title}</strong><b>{resourceCue.count ? `${resourceCue.count} ${resourceCue.count === 1 ? 'material disponible' : 'materiales disponibles'}` : 'Sin material adicional'}</b></span><button onClick={() => setResourceCue(null)} aria-label="Cerrar aviso">×</button></div>}
        </div>
        <div className="moment-transition" key={chapter.id}>
          <div className="moment-head"><div><p>MOMENTO {String(active + 1).padStart(2, '0')} / {formatTime(chapter.startSeconds)}</p><h2>{chapter.title}</h2><span>{chapter.description}</span></div><button className={completed.includes(chapter.id) ? 'complete done' : 'complete'} onClick={toggleComplete}>{completed.includes(chapter.id) ? 'Completado ✓' : 'Marcar completado'}</button></div>
          <div className="moment-resources"><div className="resource-title"><span>MATERIALES DE ESTE MOMENTO</span><b>{chapter.resources.length}</b></div>{chapter.resources.length ? chapter.resources.map(item => <HubResource key={item.id} item={item} />) : <div className="no-material">Este momento no necesita material adicional.</div>}</div>
        </div>
        {progress === 100 && <section className="completion-ritual" aria-live="polite"><div aria-hidden="true">Φ</div><span>RUTA COMPLETADA</span><h2>Convertiste el tutorial en criterio propio.</h2><p>Ya recorriste todos los momentos. Vuelve a cualquier paso para refinar el resultado o continúa construyendo con Flujo Perfecto.</p><div><button onClick={() => goTo(0)}>Revisar desde el inicio</button><a href="/">Explorar otra ruta →</a></div></section>}
        <nav className="moment-navigation" aria-label="Navegar entre momentos"><button aria-label="Ir al momento anterior" disabled={active === 0} onClick={() => goTo(active - 1)}>← <span>Anterior</span></button><div aria-hidden="true">{video.chapters.map((item, index) => <i key={item.id} className={index === active ? 'active' : completed.includes(item.id) ? 'done' : ''} />)}</div><button aria-label="Ir al momento siguiente" disabled={active === video.chapters.length - 1} onClick={() => goTo(active + 1)}><span>Siguiente</span> →</button></nav>
      </div>
    </section>
  </main>;
}
