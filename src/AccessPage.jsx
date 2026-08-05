import { useEffect, useState } from 'react';
import { api, getAuthSession } from './api.js';
import TurnstileSlot, { useTurnstile } from './Turnstile.jsx';
import Mark from './BrandMark.jsx';
import usePageMeta from './usePageMeta.js';

export default function AccessPage({ slug }) {
  const [video, setVideo] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', consent: false, website: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();
  usePageMeta({
    title: video?.title,
    description: video ? `${video.title}: accede gratis a la línea de tiempo, prompts y materiales de este tutorial de Flujo Perfecto.` : undefined,
    path: `/acceso/${slug}`,
  });

  useEffect(() => {
    api(`/api/videos/${slug}`).then(videoData => {
      if (videoData.accessMode === 'public') {
        window.location.replace(`/hub/${videoData.slug}`);
        return;
      }
      setVideo(videoData);
    }).catch(errorValue => setError(errorValue.message));
  }, [slug]);

  const submit = async event => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      const session = await getAuthSession();
      const captchaToken = session ? '' : await turnstile.execute();
      const result = await api('/api/access', { method: 'POST', body: { ...form, slug, captchaToken } });
      window.location.assign(result.redirect);
    } catch (errorValue) {
      setError(errorValue.message); setLoading(false);
    }
  };

  return <main className="gate-page">
    <a className="gate-brand" href="/"><Mark /><strong>FLUJO PERFECTO</strong></a>
    <section className="gate-visual" style={{ backgroundImage: `linear-gradient(0deg, rgba(7,5,11,.9), transparent 60%), url('${video?.coverUrl || '/images/flujo-classroom.webp'}')` }}>
      <div className="gate-code">ARCHIVO / {slug.toUpperCase()}</div>
      <div><p>RECURSOS DEL TUTORIAL</p><h1>{video?.title || 'Prepara tu espacio de construcción'}</h1><div className="gate-stats"><span><b>{video?.chapters ?? '—'}</b> momentos</span><span><b>{video?.resources ?? '—'}</b> recursos</span><span><b>∞</b> acceso</span></div></div>
    </section>
    <section className="gate-form-wrap">
      <div className="gate-form-inner">
        <p className="portal-eyebrow">ACCESO GRATUITO</p>
        <h2>Construye el tutorial, <em>paso a paso.</em></h2>
        <p>Ingresa tu correo para abrir la línea de tiempo, copiar prompts y descargar los materiales usados en el video.</p>
        <form onSubmit={submit}>
          <label>Nombre<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Tu nombre" /></label>
          <label>Correo electrónico<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="tu@correo.com" /></label>
          <input className="honey" tabIndex="-1" autoComplete="off" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} aria-hidden="true" />
          <label className="consent"><input required type="checkbox" checked={form.consent} onChange={event => setForm({ ...form, consent: event.target.checked })} /><span>Acepto recibir este material y novedades de Flujo Perfecto.</span></label>
          <TurnstileSlot turnstile={turnstile} />
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="portal-button" disabled={loading || !turnstile.ready || !form.consent}>{loading ? 'Preparando acceso…' : 'Abrir los materiales →'}</button>
        </form>
        <small>Sin spam. Puedes darte de baja cuando quieras.</small>
      </div>
    </section>
  </main>;
}
