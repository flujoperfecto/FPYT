import { useEffect, useState } from 'react';
import { api, getAuthSession } from './api.js';
import TurnstileSlot, { useTurnstile } from './Turnstile.jsx';
import Mark from './BrandMark.jsx';
import usePageMeta from './usePageMeta.js';
import PortalNotice from './PortalNotice.jsx';

export default function AccessPage({ slug }) {
  const [video, setVideo] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', consent: false, website: '' });
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();
  usePageMeta({
    title: loadError
      ? (loadError.status === 404 ? 'Tutorial no disponible' : 'No pudimos preparar el acceso')
      : video?.title || 'Acceso al tutorial',
    description: video ? `${video.title}: accede gratis a la línea de tiempo, prompts y materiales de este tutorial de Flujo Perfecto.` : undefined,
    path: `/acceso/${slug}`,
    noindex: Boolean(loadError),
  });

  useEffect(() => {
    api(`/api/videos/${slug}`).then(videoData => {
      if (videoData.accessMode === 'public') {
        window.location.replace(`/hub/${videoData.slug}`);
        return;
      }
      setVideo(videoData);
    }).catch(errorValue => {
      // El tutorial pudo cambiar de dirección o de modalidad desde el panel.
      if (errorValue.data?.redirect) window.location.replace(errorValue.data.redirect);
      else setLoadError({ status: errorValue.status, message: errorValue.message });
    });
  }, [slug]);

  const submit = async event => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      const session = await getAuthSession();
      const captchaToken = session ? '' : await turnstile.execute();
      const result = await api('/api/access', { method: 'POST', body: { ...form, tutorialId: video?.id, slug, captchaToken } });
      window.location.assign(result.redirect);
    } catch (errorValue) {
      setError(errorValue.message); setLoading(false);
    }
  };

  if (loadError) {
    return loadError.status === 404
      ? <PortalNotice
        code="ACCESO / 404"
        title={<>Este material ya no vive<br /><em>en esta dirección.</em></>}
        message="Puede haber cambiado de nombre, volver a estar en preparación o haberse retirado. La biblioteca siempre muestra las rutas vigentes."
        hint="Si guardaste este enlace, reemplázalo por el que aparece ahora en la biblioteca."
      />
      : <PortalNotice
        code="ACCESO / ERROR"
        title={<>No pudimos preparar<br /><em>tu acceso.</em></>}
        message={loadError.message}
        onRetry={() => window.location.reload()}
      />;
  }

  return <main className="gate-page">
    <a className="gate-brand" href="/"><Mark /><strong>FLUJO PERFECTO</strong></a>
    <section className="gate-visual" style={{ backgroundImage: `linear-gradient(0deg, rgba(7,5,11,.9), transparent 60%), url('${video?.coverUrl || '/images/flujo-classroom.webp'}')` }}>
      <div className="gate-code">ARCHIVO / {slug.toUpperCase()}</div>
      <div><p>RECURSOS DEL TUTORIAL</p><h1>{video?.title || 'Prepara tu espacio de construcción'}</h1><div className="gate-stats"><span><b>{video?.chapters ?? '—'}</b> momentos</span><span><b>{video?.resources ?? '—'}</b> recursos</span><span><b>∞</b> acceso</span></div><a className="gate-jump" href="#access-form">Desbloquear materiales <span aria-hidden="true">↓</span></a></div>
    </section>
    <section className="gate-form-wrap" id="access-form">
      <div className="gate-form-inner">
        <p className="portal-eyebrow">ACCESO GRATUITO</p>
        <h2>Construye el tutorial, <em>paso a paso.</em></h2>
        <p>Ingresa tu correo para abrir la línea de tiempo, copiar prompts y descargar los materiales usados en el video.</p>
        <div className="gate-benefits" aria-label="El acceso incluye"><span>Línea de tiempo</span><span>Copiar en un clic</span><span>Acceso permanente</span></div>
        <form onSubmit={submit}>
          <label>Nombre<input name="name" autoComplete="name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Tu nombre" /></label>
          <label>Correo electrónico<input name="email" autoComplete="email" required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="tu@correo.com" /></label>
          <input className="honey" name="website" tabIndex="-1" autoComplete="off" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} aria-hidden="true" />
          <label className="consent"><input required type="checkbox" checked={form.consent} onChange={event => setForm({ ...form, consent: event.target.checked })} /><span>Acepto recibir este material y novedades de Flujo Perfecto.</span></label>
          <TurnstileSlot turnstile={turnstile} />
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="portal-button" aria-describedby="access-readiness" disabled={loading || !video || !turnstile.ready || !form.consent}>{loading ? 'Preparando acceso…' : 'Abrir los materiales →'}</button>
          <p className="access-readiness" id="access-readiness" aria-live="polite">{!video ? 'Confirmando el tutorial…' : !turnstile.ready ? 'Preparando la verificación segura…' : !form.consent ? 'Acepta el consentimiento para continuar.' : 'Todo listo: el acceso se abrirá en este dispositivo.'}</p>
        </form>
        <small>Sin spam. Puedes darte de baja cuando quieras.</small>
      </div>
    </section>
  </main>;
}
