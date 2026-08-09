import Mark from './BrandMark.jsx';

// Pantalla compartida por el acceso y el aula cuando un tutorial cambió de
// dirección, dejó de estar publicado o falló la carga. Sustituye a los mensajes
// sueltos de una línea para que un enlace caduco siga sintiéndose parte del sitio.
export default function PortalNotice({ code = 'ARCHIVO / ERROR', title, message, hint = '', onRetry = null }) {
  return <main className="portal-notice">
    <a className="brand" href="/"><Mark /><strong>FLUJO PERFECTO</strong></a>
    <section>
      <p>{code}</p>
      <h1>{title}</h1>
      <span>{message}</span>
      {hint && <small>{hint}</small>}
      <div className="portal-notice-actions">
        {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
        <a href="/#biblioteca">Ver la biblioteca →</a>
      </div>
    </section>
  </main>;
}
