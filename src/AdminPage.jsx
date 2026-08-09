import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RESOURCE_LABELS, api, copyText, formatTime, youtubeId } from './api.js';
import TurnstileSlot, { useTurnstile } from './Turnstile.jsx';
import Mark from './BrandMark.jsx';
import usePageMeta from './usePageMeta.js';

const editableFields = ['title', 'status', 'youtubeUrl', 'accessMode', 'description', 'slug', 'coverUrl'];

function Login({ onSuccess, initialError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();
  const submit = async event => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const captchaToken = await turnstile.execute();
      await api('/api/admin/login', { method: 'POST', body: { email, password, captchaToken } });
      await onSuccess();
    } catch (errorValue) { setError(errorValue.message); setLoading(false); }
  };
  return <main className="admin-login"><section><Mark /><p>PANEL PROTEGIDO</p><h1>Gestiona lo que<br /><em>otros construirán.</em></h1><form onSubmit={submit}><label>Correo de administrador<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" autoFocus placeholder="tu@correo.com" /></label><label>Contraseña<input type="password" required minLength="12" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••••••" /></label><TurnstileSlot turnstile={turnstile} />{error && <div className="form-error">{error}</div>}<button className="portal-button" disabled={loading || !turnstile.ready}>{loading ? 'Verificando…' : 'Ingresar →'}</button></form><small>Acceso protegido con Supabase Auth y Turnstile.</small></section></main>;
}

function ResourceForm({ videoId, chapterId, onCreated }) {
  const [type, setType] = useState('prompt');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async event => {
    event.preventDefault(); setError(''); setSaving(true);
    const formElement = event.currentTarget;
    try {
      await api(`/api/admin/videos/${videoId}/chapters/${chapterId}/resources`, { method: 'POST', body: new FormData(formElement) });
      formElement.reset(); setType('prompt'); await onCreated();
    } catch (errorValue) { setError(errorValue.message); }
    finally { setSaving(false); }
  };
  return <form className="resource-form" onSubmit={submit}>
    <div className="field-row"><label>Tipo<select name="type" value={type} onChange={event => setType(event.target.value)}>{Object.entries(RESOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Título<input name="title" required placeholder="Nombre del material" /></label></div>
    {['prompt', 'instruction', 'skill'].includes(type) && <label>Contenido<textarea name="content" rows="7" required placeholder="Texto listo para copiar…" /></label>}
    {type === 'link' && <label>URL del recurso<input name="url" type="url" required placeholder="https://…" /></label>}
    {type === 'file' && <label>Archivo (máx. 25 MB)<input name="file" type="file" required /></label>}
    <label>Descripción opcional<input name="description" placeholder="Qué es y cuándo usarlo" /></label>
    {error && <div className="form-error" role="alert">{error}</div>}<button className="small-primary" disabled={saving}>{saving ? 'Agregando…' : 'Agregar recurso +'}</button>
  </form>;
}

function moveIds(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items.map(item => item.id);
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map(item => item.id);
}

function AdminSidebar() {
  return <aside className="admin-sidebar"><a className="brand" href="/"><Mark /><strong>FP / ADMIN</strong></a><nav><button className="active">▦ Tutoriales</button><a href="/" target="_blank" rel="noreferrer">↗ Ver sitio público</a></nav><div><span>SISTEMA</span><i /> Operativo</div></aside>;
}

function AdminStats({ overview, busy, onCreateVideo }) {
  return <section className="admin-stats"><article><span>Tutoriales</span><b>{overview?.videos ?? '—'}</b></article><article><span>Publicados</span><b>{overview?.published ?? '—'}</b></article><article><span>Suscriptores</span><b>{overview?.leads ?? '—'}</b></article><button onClick={onCreateVideo} disabled={Boolean(busy)}>{busy === 'create-video' ? 'Creando…' : 'Nuevo tutorial +'}</button></section>;
}

function VideoListPanel({ videos, filteredVideos, query, setQuery, statusFilter, setStatusFilter, accessFilter, setAccessFilter, selectedId, onChoose }) {
  return <aside className="video-list">
    <div><span>CONTENIDOS</span><b>{filteredVideos.length}/{videos.length}</b></div>
    <div className="catalog-tools"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar tutorial…" aria-label="Buscar tutorial" /><div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filtrar por estado"><option value="all">Todos</option><option value="published">Publicados</option><option value="draft">Borradores</option></select><select value={accessFilter} onChange={event => setAccessFilter(event.target.value)} aria-label="Filtrar por acceso"><option value="all">Todo acceso</option><option value="public">Público</option><option value="email">Con email</option></select></div></div>
    {filteredVideos.map(video => <button className={video.id === selectedId ? 'active' : ''} key={video.id} onClick={() => onChoose(video.id)}><i className={video.status} /><span><strong>{video.title}</strong><small>{video.chapters.length} momentos · {video.status === 'published' ? 'Publicado' : 'Borrador'} · {video.accessMode === 'public' ? 'Público' : 'Con email'}</small></span></button>)}
    {!filteredVideos.length && <div className="catalog-empty">No hay tutoriales con esos filtros.</div>}
  </aside>;
}

function VideoEditorHeader({ selected, dirty, busy, onDuplicate, onDelete }) {
  const [copied, setCopied] = useState(false);
  const copyMaterialsLink = async () => {
    await copyText(`${window.location.origin}/materiales/${selected.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return <div className="editor-head"><div><span>EDITANDO {dirty && <b className="dirty-dot">CAMBIOS PENDIENTES</b>}</span><h2>{selected.title}</h2></div><div className="editor-actions"><a href={`/hub/${selected.slug}?preview=1`} target="_blank" rel="noreferrer">Vista previa ↗</a><button onClick={copyMaterialsLink} title="Link para pegar en la descripción de YouTube">{copied ? 'Copiado ✓' : 'Link de materiales'}</button><button onClick={onDuplicate} disabled={Boolean(busy)}>{busy === 'duplicate-video' ? 'Duplicando…' : 'Duplicar'}</button><button className="danger" onClick={onDelete} disabled={Boolean(busy)}>Eliminar</button></div></div>;
}

function VideoForm({ selected, draft, dirty, busy, setField, onSubmit, onDiscard, onUploadCover, onRemoveCover }) {
  const videoId = youtubeId(draft.youtubeUrl);
  return <form className="video-form" onSubmit={onSubmit}>
    <div className="field-row"><label>Título<input required value={draft.title} onChange={event => setField('title', event.target.value)} /></label><label>Estado<select value={draft.status} onChange={event => setField('status', event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></div>
    <label>URL de YouTube<input type="url" value={draft.youtubeUrl} onChange={event => setField('youtubeUrl', event.target.value)} placeholder="https://youtube.com/watch?v=…" /></label>
    {videoId && <aside className="youtube-verification"><img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="Miniatura obtenida de YouTube" /><div><span>VERIFICACIÓN DE CONTENIDO</span><strong>¿La miniatura coincide con este tutorial?</strong><p>Comprueba título, portada y capítulos antes de publicar. Una URL incorrecta rompe la continuidad de la experiencia.</p><a href={draft.youtubeUrl} target="_blank" rel="noreferrer">Abrir video en YouTube ↗</a></div></aside>}
    <div className={`access-setting ${draft.accessMode === 'public' ? 'is-public' : ''}`}><label>Acceso al material<select value={draft.accessMode || 'email'} onChange={event => setField('accessMode', event.target.value)}><option value="email">Solicita email</option><option value="public">Público, sin email</option></select></label><div><strong>{draft.accessMode === 'public' ? 'Acceso directo activado' : 'Captura de email activada'}</strong><span>{draft.accessMode === 'public' ? 'El enlace llevará directamente al hub y sus materiales.' : 'El suscriptor deberá ingresar su correo antes de abrir el hub.'}</span></div></div>
    <label>Descripción<textarea rows="3" value={draft.description} onChange={event => setField('description', event.target.value)} /></label>
    <div className="field-row"><label>URL pública<input required value={draft.slug} onChange={event => setField('slug', event.target.value)} /></label><label>URL externa de portada<input value={draft.coverUrl} onChange={event => setField('coverUrl', event.target.value)} /></label></div>
    <div className="cover-manager"><img src={draft.coverUrl || '/images/flujo-classroom.webp'} alt="Vista previa de la portada" /><div><strong>Portada del tutorial</strong><span>WebP, JPG, PNG o AVIF · máximo 8 MB</span><label className="cover-upload">{busy === 'cover' ? 'Procesando…' : 'Subir imagen'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onUploadCover} disabled={Boolean(busy)} /></label>{selected.coverStoragePath && <button type="button" onClick={onRemoveCover} disabled={Boolean(busy)}>Restablecer</button>}</div></div>
    <div className={dirty ? 'form-actions is-dirty' : 'form-actions'}><button className="small-primary" disabled={!dirty || Boolean(busy)}>{busy === 'save-video' ? 'Guardando…' : dirty ? 'Guardar tutorial' : 'Todo guardado ✓'}</button>{dirty && <button type="button" className="text-button" onClick={onDiscard}>Descartar cambios</button>}</div>
  </form>;
}

function ChapterTimeline({ selected, chapterId, busy, onSelectChapter, onAddChapter, onReorderChapter }) {
  return <>
    <div className="chapter-admin-head"><div><span>LÍNEA DE TIEMPO</span><b>{selected.chapters.length} momentos</b></div><button onClick={onAddChapter} disabled={Boolean(busy)}>{busy === 'add-chapter' ? 'Agregando…' : 'Agregar momento +'}</button></div>
    <div className="chapter-admin-tabs">{selected.chapters.map((item, index) => <div className={item.id === chapterId ? 'active chapter-tab' : 'chapter-tab'} key={item.id}><button className="chapter-select" onClick={() => onSelectChapter(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong><small>{formatTime(item.startSeconds)}</small></button><div className="order-buttons"><button aria-label={`Subir ${item.title}`} disabled={index === 0 || Boolean(busy)} onClick={() => onReorderChapter(index, -1)}>↑</button><button aria-label={`Bajar ${item.title}`} disabled={index === selected.chapters.length - 1 || Boolean(busy)} onClick={() => onReorderChapter(index, 1)}>↓</button></div></div>)}</div>
  </>;
}

function ChapterEditorPanel({ chapter, selectedId, busy, onSave, onDuplicate, onDelete, onReorderResource, onRemoveResource, onResourceCreated }) {
  return <section className="chapter-editor">
    <div className="chapter-tools"><button onClick={onDuplicate} disabled={Boolean(busy)}>{busy === 'duplicate-chapter' ? 'Duplicando…' : 'Duplicar momento'}</button><button className="danger" onClick={onDelete} disabled={Boolean(busy)}>Eliminar momento</button></div>
    <form onSubmit={onSave}><div className="field-row"><label>Nombre del momento<input name="title" required defaultValue={chapter.title} key={`${chapter.id}-title`} /></label><label>Inicio (segundos)<input name="startSeconds" type="number" min="0" defaultValue={chapter.startSeconds} key={`${chapter.id}-time`} /></label></div><label>Descripción<input name="description" defaultValue={chapter.description} key={`${chapter.id}-desc`} /></label><button className="text-button" disabled={Boolean(busy)}>{busy === 'save-chapter' ? 'Guardando…' : 'Guardar momento'}</button></form>
    <div className="existing-resources"><div><span>RECURSOS ADJUNTOS</span><b>{chapter.resources.length}</b></div>{chapter.resources.map((item, index) => <article key={item.id}><span>{RESOURCE_LABELS[item.type]}</span><strong>{item.title}</strong><div className="resource-admin-actions"><button disabled={index === 0 || Boolean(busy)} aria-label={`Subir ${item.title}`} onClick={() => onReorderResource(index, -1)}>↑</button><button disabled={index === chapter.resources.length - 1 || Boolean(busy)} aria-label={`Bajar ${item.title}`} onClick={() => onReorderResource(index, 1)}>↓</button><button className="danger" disabled={Boolean(busy)} onClick={() => onRemoveResource(item.id)}>Eliminar</button></div></article>)}</div>
    <details className="add-resource" open><summary>Agregar material a este momento</summary><ResourceForm videoId={selectedId} chapterId={chapter.id} onCreated={onResourceCreated} /></details>
  </section>;
}

function LeadsPanel({ overview, busy, onRemoveLead }) {
  return <section className="admin-leads"><div className="admin-leads-head"><div><span>SUSCRIPTORES RECIENTES</span><h2>Accesos entregados</h2></div><b>{overview?.leads ?? 0}</b></div>{overview?.recentLeads?.length ? <div className="admin-lead-list">{overview.recentLeads.map(lead => <article key={lead.id}><div><strong>{lead.name || 'Sin nombre'}</strong><span>{lead.email}</span></div><small>{lead.videoTitle}</small><time>{new Date(lead.createdAt).toLocaleDateString('es-CL')}</time><button onClick={() => onRemoveLead(lead.id)} disabled={Boolean(busy)}>Revocar</button></article>)}</div> : <div className="admin-leads-empty">Aún no hay suscriptores registrados.</div>}</section>;
}

export default function AdminPage() {
  usePageMeta({ title: 'Panel administrativo', path: '/admin', noindex: true });
  const [authenticated, setAuthenticated] = useState(null);
  const [videos, setVideos] = useState([]);
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [chapterId, setChapterId] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const savedRef = useRef(null);

  useEffect(() => { document.title = 'Panel editorial — Flujo Perfecto'; }, []);

  const selected = useMemo(() => videos.find(video => video.id === selectedId), [videos, selectedId]);
  const chapter = selected?.chapters.find(item => item.id === chapterId);
  const dirty = useMemo(() => Boolean(selected && draft && editableFields.some(field => String(selected[field] ?? '') !== String(draft[field] ?? ''))), [draft, selected]);
  const filteredVideos = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return videos.filter(video => (!term || `${video.title} ${video.slug}`.toLocaleLowerCase('es').includes(term))
      && (statusFilter === 'all' || video.status === statusFilter)
      && (accessFilter === 'all' || video.accessMode === accessFilter));
  }, [accessFilter, query, statusFilter, videos]);

  const load = useCallback(async () => {
    const [videoData, overviewData] = await Promise.all([api('/api/admin/videos'), api('/api/admin/overview')]);
    setVideos(videoData); setOverview(overviewData);
    setSelectedId(current => videoData.some(video => video.id === current) ? current : videoData[0]?.id || '');
  }, []);

  useEffect(() => { api('/api/admin/status').then(async result => { setAuthenticated(result.authenticated); if (result.authenticated) await load(); }).catch(errorValue => { setAuthenticated(false); setNotice({ type: 'error', text: errorValue.message }); }); }, [load]);
  // Subir una portada o tocar los momentos recarga el catálogo y devuelve un
  // `selected` nuevo. Reemplazar el borrador completo aquí borraba lo que el
  // editor estaba escribiendo, así que solo cedemos los campos que él no tocó.
  useEffect(() => {
    if (!selected) { savedRef.current = null; setDraft(null); return; }
    // Se lee antes de encolar la actualización: el updater corre durante el
    // render, cuando el ref ya apuntaría a la versión nueva.
    const saved = savedRef.current;
    savedRef.current = selected;
    setDraft(current => {
      if (!current || current.id !== selected.id || saved?.id !== selected.id) return { ...selected };
      const merged = { ...selected };
      editableFields.forEach(field => {
        if (String(current[field] ?? '') !== String(saved[field] ?? '')) merged[field] = current[field];
      });
      return merged;
    });
    setChapterId(current => selected.chapters.some(item => item.id === current) ? current : selected.chapters[0]?.id || '');
  }, [selected]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (authenticated === null) return <div className="portal-status">Verificando acceso…</div>;
  if (!authenticated) return <Login initialError={notice?.text} onSuccess={async () => { setAuthenticated(true); try { await load(); } catch (errorValue) { setNotice({ type: 'error', text: errorValue.message }); } }} />;

  const refresh = async keepId => {
    const [data, overviewData] = await Promise.all([api('/api/admin/videos'), api('/api/admin/overview')]);
    setVideos(data); setOverview(overviewData);
    setSelectedId(data.some(video => video.id === keepId) ? keepId : data[0]?.id || '');
    return data;
  };
  const act = async (key, action, success) => {
    setBusy(key); setNotice(null);
    try { const result = await action(); if (success) setNotice({ type: result?.warning ? 'warning' : 'success', text: result?.warning || success }); return result; }
    catch (errorValue) { setNotice({ type: 'error', text: errorValue.message }); return null; }
    finally { setBusy(''); }
  };
  const chooseVideo = id => {
    if (id === selectedId) return;
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y abrir otro tutorial?')) return;
    setSelectedId(id); setNotice(null);
  };
  const createVideo = () => act('create-video', async () => {
    const video = await api('/api/admin/videos', { method: 'POST', body: { title: 'Nuevo tutorial' } });
    await refresh(video.id); return video;
  }, 'Tutorial creado como borrador.');
  const saveVideo = async event => {
    event.preventDefault();
    const visibilityChanged = selected.status !== draft.status || selected.accessMode !== draft.accessMode;
    if (visibilityChanged && !window.confirm(`Vas a guardar este tutorial como ${draft.status === 'published' ? 'publicado' : 'borrador'} y con acceso ${draft.accessMode === 'public' ? 'público' : 'mediante email'}. ¿Continuar?`)) return;
    await act('save-video', async () => { const saved = await api(`/api/admin/videos/${draft.id}`, { method: 'PUT', body: draft }); await refresh(saved.id); return saved; }, 'Cambios guardados ✓');
  };
  const duplicateVideo = () => act('duplicate-video', async () => {
    const copy = await api(`/api/admin/videos/${selected.id}/duplicate`, { method: 'POST' }); await refresh(copy.id); return copy;
  }, 'Copia creada como borrador.');
  const deleteVideo = async () => {
    if (!window.confirm(`¿Eliminar definitivamente “${selected.title}”, sus momentos y todos sus materiales? Esta acción no se puede deshacer.`)) return;
    await act('delete-video', async () => { const result = await api(`/api/admin/videos/${selected.id}`, { method: 'DELETE' }); await refresh(''); return result; }, 'Tutorial eliminado.');
  };
  const uploadCover = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const form = new FormData(); form.set('file', file);
    await act('cover', async () => { const saved = await api(`/api/admin/videos/${selected.id}/cover`, { method: 'POST', body: form }); await refresh(saved.id); return saved; }, 'Portada actualizada ✓');
  };
  const removeCover = async () => {
    if (!window.confirm('¿Quitar la portada cargada y recuperar la imagen predeterminada?')) return;
    await act('cover', async () => { const saved = await api(`/api/admin/videos/${selected.id}/cover`, { method: 'DELETE' }); await refresh(saved.id); return saved; }, 'Portada restablecida.');
  };
  const addChapter = () => act('add-chapter', async () => {
    const created = await api(`/api/admin/videos/${selected.id}/chapters`, { method: 'POST', body: { title: 'Nuevo momento', startSeconds: 0 } });
    await refresh(selected.id); setChapterId(created.id); return created;
  }, 'Momento agregado.');
  const saveChapter = async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await act('save-chapter', async () => { const saved = await api(`/api/admin/videos/${selected.id}/chapters/${chapter.id}`, { method: 'PUT', body: Object.fromEntries(form) }); await refresh(selected.id); return saved; }, 'Momento actualizado ✓');
  };
  const duplicateChapter = () => act('duplicate-chapter', async () => {
    const copy = await api(`/api/admin/videos/${selected.id}/chapters/${chapter.id}/duplicate`, { method: 'POST' }); await refresh(selected.id); setChapterId(copy.id); return copy;
  }, 'Momento y materiales duplicados.');
  const deleteChapter = async () => {
    if (!window.confirm(`¿Eliminar “${chapter.title}” y sus ${chapter.resources.length} materiales? Esta acción no se puede deshacer.`)) return;
    await act('delete-chapter', async () => { const result = await api(`/api/admin/videos/${selected.id}/chapters/${chapter.id}`, { method: 'DELETE' }); await refresh(selected.id); return result; }, 'Momento eliminado.');
  };
  const reorderChapter = (index, direction) => act('order-chapters', async () => {
    await api(`/api/admin/videos/${selected.id}/chapters/order`, { method: 'PUT', body: { chapterIds: moveIds(selected.chapters, index, direction) } }); await refresh(selected.id);
  }, 'Línea de tiempo reordenada.');
  const reorderResource = (index, direction) => act('order-resources', async () => {
    await api(`/api/admin/videos/${selected.id}/chapters/${chapter.id}/resources/order`, { method: 'PUT', body: { resourceIds: moveIds(chapter.resources, index, direction) } }); await refresh(selected.id);
  }, 'Materiales reordenados.');
  const removeResource = async resourceId => {
    if (!window.confirm('¿Eliminar este recurso del momento?')) return;
    await act('remove-resource', async () => { const result = await api(`/api/admin/videos/${selected.id}/chapters/${chapter.id}/resources/${resourceId}`, { method: 'DELETE' }); await refresh(selected.id); return result; }, 'Recurso eliminado.');
  };
  const removeLead = async leadId => {
    if (!window.confirm('¿Eliminar este suscriptor y revocar todos sus accesos?')) return;
    await act('remove-lead', async () => { const result = await api(`/api/admin/leads/${leadId}`, { method: 'DELETE' }); await refresh(selected?.id); return result; }, 'Suscriptor eliminado y acceso revocado ✓');
  };
  const logout = async () => { if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar sesión de todos modos?')) return; await api('/api/admin/logout', { method: 'POST' }); window.location.reload(); };
  const setField = (field, value) => setDraft(current => ({ ...current, [field]: value }));

  return <main className="admin-page">
    <AdminSidebar />
    <div className="admin-content">
      <header className="admin-top"><div><p>PANEL DE CONTENIDOS</p><h1>Tutoriales</h1></div><div className="admin-top-actions"><a href="/" target="_blank" rel="noreferrer">Ver sitio ↗</a><button onClick={logout}>Cerrar sesión</button></div></header>
      <AdminStats overview={overview} busy={busy} onCreateVideo={createVideo} />
      <section className="admin-workspace">
        <VideoListPanel
          videos={videos}
          filteredVideos={filteredVideos}
          query={query}
          setQuery={setQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          accessFilter={accessFilter}
          setAccessFilter={setAccessFilter}
          selectedId={selectedId}
          onChoose={chooseVideo}
        />
        {draft ? <div className="editor">
          <VideoEditorHeader selected={selected} dirty={dirty} busy={busy} onDuplicate={duplicateVideo} onDelete={deleteVideo} />
          {notice && <div className={`admin-message ${notice.type}`} role="status" aria-live="polite">{notice.text}</div>}
          <VideoForm
            selected={selected}
            draft={draft}
            dirty={dirty}
            busy={busy}
            setField={setField}
            onSubmit={saveVideo}
            onDiscard={() => setDraft({ ...selected })}
            onUploadCover={uploadCover}
            onRemoveCover={removeCover}
          />
          <ChapterTimeline
            selected={selected}
            chapterId={chapterId}
            busy={busy}
            onSelectChapter={setChapterId}
            onAddChapter={addChapter}
            onReorderChapter={reorderChapter}
          />
          {chapter ? <ChapterEditorPanel
            chapter={chapter}
            selectedId={selected.id}
            busy={busy}
            onSave={saveChapter}
            onDuplicate={duplicateChapter}
            onDelete={deleteChapter}
            onReorderResource={reorderResource}
            onRemoveResource={removeResource}
            onResourceCreated={() => refresh(selected.id)}
          /> : <div className="chapter-empty">Agrega el primer momento para comenzar la línea de tiempo.</div>}
        </div> : <div className="editor-empty"><Mark /><h2>Crea tu primer tutorial</h2><p>Luego podrás organizar momentos y entregar materiales adaptados a cada video.</p><button onClick={createVideo}>Nuevo tutorial +</button></div>}
      </section>
      <LeadsPanel overview={overview} busy={busy} onRemoveLead={removeLead} />
    </div>
  </main>;
}
