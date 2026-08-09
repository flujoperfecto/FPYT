import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RESOURCE_LABELS, api, copyText, downloadResource, downloadTextFile, formatTime, safeFileName, youtubeId } from './api.js';
import Mark from './BrandMark.jsx';
import usePageMeta from './usePageMeta.js';
import PortalNotice from './PortalNotice.jsx';

const READABLE = ['prompt', 'instruction', 'skill'];
const FILE_ICONS = { pdf: 'PDF', zip: 'ZIP', rar: 'ZIP', doc: 'DOC', docx: 'DOC', txt: 'TXT', md: 'MD', csv: 'CSV', xlsx: 'XLS', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', webp: 'IMG', svg: 'SVG', mp3: 'AUD', mp4: 'VID', json: 'JSON' };
const TYPE_GLYPHS = { prompt: '⌘', instruction: '§', skill: '◈', link: '↗', file: '▤' };

function fileBadge(item) {
  const extension = String(item.originalName || '').split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[extension] || (extension ? extension.slice(0, 4).toUpperCase() : 'FILE');
}

function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  const copy = useCallback(async text => {
    await copyText(text);
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }, []);
  return [copied, copy];
}

function MaterialModal({ item, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [copied, copy] = useCopyFeedback();

  useEffect(() => {
    if (!item) return;
    const previousFocus = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = event => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
  return <div className="material-modal-wrap">
    <button className="material-modal-scrim" onClick={onClose} aria-label="Cerrar material" tabIndex={-1} />
    <aside className="material-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="material-modal-title">
      <div className="material-modal-head"><span>{RESOURCE_LABELS[item.type] || item.type}</span><button ref={closeButtonRef} onClick={onClose} aria-label="Cerrar">×</button></div>
      <h2 id="material-modal-title">{item.title}</h2>
      {item.description && <p className="material-modal-description">{item.description}</p>}
      <div className="material-modal-actions">
        <button className="is-primary" onClick={() => copy(item.content)}>{copied ? 'Copiado ✓' : 'Copiar todo'}</button>
        {item.type === 'skill' && <button onClick={() => downloadTextFile(`${safeFileName(item.title)}.md`, item.content)}>Descargar SKILL.md ↓</button>}
      </div>
      <pre>{item.content}</pre>
      <div className="material-modal-note"><Mark /><p>Adáptalo a tu contexto. Entender la intención del material produce mejores resultados que copiarlo sin cambios.</p></div>
    </aside>
  </div>;
}

function MaterialCard({ item, onOpen }) {
  const [copied, copy] = useCopyFeedback();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const readable = READABLE.includes(item.type);

  const download = async () => {
    setDownloading(true); setDownloadError('');
    try { await downloadResource(item); }
    catch (errorValue) { setDownloadError(errorValue.message); }
    finally { setDownloading(false); }
  };

  return <article className={`material-card is-${item.type}`}>
    <i aria-hidden="true">{item.type === 'file' ? fileBadge(item) : TYPE_GLYPHS[item.type] || '•'}</i>
    <div>
      <span>{RESOURCE_LABELS[item.type] || item.type}</span>
      <h3>{item.title}</h3>
      {item.description && <p>{item.description}</p>}
      {item.type === 'file' && item.originalName && <small>{item.originalName}</small>}
      {downloadError && <p className="resource-error" role="alert">{downloadError}</p>}
    </div>
    <div className="material-card-actions">
      {readable && <><button className="is-primary" onClick={() => onOpen(item)}>Abrir</button><button onClick={() => copy(item.content)}>{copied ? 'Copiado ✓' : 'Copiar'}</button></>}
      {item.type === 'skill' && <button onClick={() => downloadTextFile(`${safeFileName(item.title)}.md`, item.content)}>Descargar ↓</button>}
      {item.type === 'link' && <a className="is-primary" href={item.url} target="_blank" rel="noreferrer">Abrir ↗</a>}
      {item.type === 'file' && <button className="is-primary" onClick={download} disabled={downloading}>{downloading ? 'Preparando…' : 'Descargar ↓'}</button>}
    </div>
  </article>;
}

export default function MaterialsPage({ slug }) {
  const [video, setVideo] = useState(null);
  const [error, setError] = useState(null);
  const [openItem, setOpenItem] = useState(null);

  useEffect(() => {
    api(`/api/materials/${slug}`).then(setVideo).catch(errorValue => {
      if (errorValue.data?.redirect) window.location.replace(errorValue.data.redirect);
      else setError({ status: errorValue.status, message: errorValue.message });
    });
  }, [slug]);

  usePageMeta({
    title: error
      ? (error.status === 404 ? 'Materiales no disponibles' : 'No pudimos abrir los materiales')
      : video?.title ? `Materiales · ${video.title}` : 'Materiales del video',
    description: video ? `Prompts, skills y archivos del video “${video.title}”, en el mismo orden en que aparecen.` : undefined,
    path: `/materiales/${slug}`,
    noindex: Boolean(error) || Boolean(video && !video.chapters?.length),
  });

  const closeModal = useCallback(() => setOpenItem(null), []);
  const videoId = youtubeId(video?.youtubeUrl);
  const totalResources = useMemo(() => video?.chapters?.reduce((sum, item) => sum + item.resources.length, 0) || 0, [video]);
  const watchAt = seconds => (videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s` : video?.youtubeUrl || '#');

  if (error) {
    return error.status === 404
      ? <PortalNotice
        code="MATERIALES / 404"
        title={<>Estos materiales ya no viven<br /><em>en esta dirección.</em></>}
        message="El tutorial puede haber cambiado de nombre, volver a estar en preparación o haberse retirado."
        hint="La biblioteca siempre muestra las rutas vigentes."
      />
      : <PortalNotice
        code="MATERIALES / ERROR"
        title={<>No pudimos preparar<br /><em>los materiales.</em></>}
        message={error.message}
        onRetry={() => window.location.reload()}
      />;
  }
  if (!video) return <div className="portal-status" role="status"><i /> Preparando los materiales…</div>;

  return <main className="materials-page">
    <header className="materials-header">
      <a className="brand" href="/"><Mark /><strong>FLUJO PERFECTO</strong></a>
      {video.youtubeUrl && <a className="materials-back" href={video.youtubeUrl} target="_blank" rel="noreferrer">← Volver al video en YouTube</a>}
    </header>

    <section className="materials-hero">
      <p className="portal-eyebrow">MATERIALES DEL VIDEO</p>
      <h1>{video.title}</h1>
      {video.description && <p className="materials-lead">{video.description}</p>}
      <div className="materials-stats">
        <span><b>{video.chapters.length}</b> {video.chapters.length === 1 ? 'momento' : 'momentos'}</span>
        <span><b>{totalResources}</b> {totalResources === 1 ? 'material' : 'materiales'}</span>
        <span>Sigue el video en YouTube · aquí solo están los recursos</span>
      </div>
    </section>

    {video.chapters.length ? <div className="material-stream">
      {video.chapters.map((chapter, index) => <section className="stream-node" key={chapter.id}>
        <i aria-hidden="true" />
        <div className="stream-node-head">
          <a className="stream-time" href={watchAt(chapter.startSeconds)} target="_blank" rel="noreferrer" title="Abrir este momento en YouTube">{formatTime(chapter.startSeconds)} ↗</a>
          <p>MOMENTO {String(index + 1).padStart(2, '0')}</p>
          <h2>{chapter.title}</h2>
          {chapter.description && <span>{chapter.description}</span>}
        </div>
        <div className="stream-node-materials">
          {chapter.resources.length
            ? chapter.resources.map(item => <MaterialCard key={item.id} item={item} onOpen={setOpenItem} />)
            : <div className="no-material">Este momento no necesita material adicional.</div>}
        </div>
      </section>)}
    </div> : <div className="portal-status">Este tutorial aún no tiene materiales publicados.</div>}

    <section className="materials-outro">
      <span>SIGUE EN YOUTUBE</span>
      <h2>Los materiales ya son tuyos. El video sigue donde lo dejaste.</h2>
      <p>Vuelve al video para terminar el recorrido, y si quieres la versión con capítulos sincronizados y progreso guardado, el aula interactiva te espera.</p>
      <div>
        {video.youtubeUrl && <a className="is-primary" href={video.youtubeUrl} target="_blank" rel="noreferrer">Volver al video ↗</a>}
        <a href={`/hub/${video.slug}`}>Abrir el aula interactiva →</a>
      </div>
    </section>

    <MaterialModal item={openItem} onClose={closeModal} />
  </main>;
}
