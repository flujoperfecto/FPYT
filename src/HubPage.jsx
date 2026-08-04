import { useEffect, useMemo, useState } from 'react';
import { RESOURCE_LABELS, api, copyText, downloadResource, formatTime, youtubeId } from './api.js';
import Mark from './BrandMark.jsx';

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
    <span>{RESOURCE_LABELS[item.type] || item.type}</span><div><h4>{item.title}</h4>{item.description && <p>{item.description}</p>}</div>
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

  useEffect(() => {
    api(preview ? `/api/admin/preview/${slug}` : `/api/hub/${slug}`).then(data => {
      setVideo(data);
      let stored = [];
      try { stored = JSON.parse(localStorage.getItem(`fp-progress-${data.id}`) || '[]'); }
      catch { stored = []; }
      const chapterIds = new Set(data.chapters.map(item => item.id));
      setCompleted([...new Set(Array.isArray(stored) ? stored : [])].filter(id => chapterIds.has(id)));
    }).catch(errorValue => {
      if (errorValue.status === 401) window.location.assign(errorValue.data.redirect);
      else setError(errorValue.message);
    });
  }, [preview, slug]);

  const chapter = video?.chapters?.[active];
  const videoId = youtubeId(video?.youtubeUrl);
  const progress = useMemo(() => video?.chapters?.length ? Math.min(100, Math.round((completed.length / video.chapters.length) * 100)) : 0, [completed, video]);
  const toggleComplete = () => {
    const next = completed.includes(chapter.id) ? completed.filter(id => id !== chapter.id) : [...completed, chapter.id];
    setCompleted(next); localStorage.setItem(`fp-progress-${video.id}`, JSON.stringify(next));
  };
  const goTo = index => setActive(Math.max(0, Math.min(video.chapters.length - 1, index)));

  if (error) return <div className="portal-status">{error}</div>;
  if (!video) return <div className="portal-status">Preparando el aula…</div>;
  if (!chapter) return <div className="portal-status">Este tutorial aún no tiene momentos publicados.</div>;

  return <main className="hub-page">
    {preview && <div className="preview-banner"><strong>Vista previa del administrador</strong><span>Este contenido todavía puede estar oculto para tus suscriptores.</span><a href="/admin">Volver al panel</a></div>}
    <header className="hub-header"><a className="brand" href="/"><Mark /><strong>FLUJO PERFECTO</strong></a><div className="hub-progress"><span><i style={{ width: `${progress}%` }} /></span><b>{progress}% completado</b></div><a href={video.youtubeUrl || '#'} target="_blank" rel="noreferrer">Ver en YouTube ↗</a></header>
    <div className="hub-title"><p>TUTORIAL / AULA INTERACTIVA</p><h1>{video.title}</h1></div>
    <section className="hub-workspace">
      <aside className="timeline"><div className="timeline-head"><span>LÍNEA DE TIEMPO</span><b>{video.chapters.length} momentos</b></div>{video.chapters.map((item, index) => <button key={item.id} className={index === active ? 'active' : ''} aria-current={index === active ? 'step' : undefined} onClick={() => setActive(index)}><i className={completed.includes(item.id) ? 'done' : ''} /><span>{formatTime(item.startSeconds)}</span><strong>{item.title}</strong><small>{item.resources.length} {item.resources.length === 1 ? 'recurso' : 'recursos'}</small></button>)}</aside>
      <div className="hub-main">
        <div className="hub-player">
          {videoId ? <iframe key={`${videoId}-${chapter.startSeconds}`} src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${chapter.startSeconds}&rel=0`} title={video.title} allowFullScreen /> : <div className="player-poster" style={{ backgroundImage: `url('${video.coverUrl || '/images/flujo-classroom.webp'}')` }}><span>▶</span><p>Agrega la URL de YouTube desde el panel administrador</p></div>}
        </div>
        <div className="moment-transition" key={chapter.id}>
          <div className="moment-head"><div><p>MOMENTO {String(active + 1).padStart(2, '0')} / {formatTime(chapter.startSeconds)}</p><h2>{chapter.title}</h2><span>{chapter.description}</span></div><button className={completed.includes(chapter.id) ? 'complete done' : 'complete'} onClick={toggleComplete}>{completed.includes(chapter.id) ? 'Completado ✓' : 'Marcar completado'}</button></div>
          <div className="moment-resources"><div className="resource-title"><span>MATERIALES DE ESTE MOMENTO</span><b>{chapter.resources.length}</b></div>{chapter.resources.length ? chapter.resources.map(item => <HubResource key={item.id} item={item} />) : <div className="no-material">Este momento no necesita material adicional.</div>}</div>
        </div>
        <nav className="moment-navigation" aria-label="Navegar entre momentos"><button disabled={active === 0} onClick={() => goTo(active - 1)}>← <span>Anterior</span></button><div>{video.chapters.map((item, index) => <i key={item.id} className={index === active ? 'active' : completed.includes(item.id) ? 'done' : ''} />)}</div><button disabled={active === video.chapters.length - 1} onClick={() => goTo(active + 1)}><span>Siguiente</span> →</button></nav>
      </div>
    </section>
  </main>;
}
