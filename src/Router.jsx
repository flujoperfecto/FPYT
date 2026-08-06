import { lazy, Suspense, useEffect } from 'react';
import App from './App.jsx';
import Mark from './BrandMark.jsx';

const AccessPage = lazy(() => import('./AccessPage.jsx'));
const HubPage = lazy(() => import('./HubPage.jsx'));
const AdminPage = lazy(() => import('./AdminPage.jsx'));

function NotFound() {
  useEffect(() => { document.title = 'Página no encontrada — Flujo Perfecto'; }, []);
  return <main className="not-found-page"><Mark /><p>ERROR / 404</p><h1>Esta ruta aún<br /><em>no ha sido construida.</em></h1><span>Vuelve al archivo principal para encontrar tutoriales, materiales y rutas activas.</span><a href="/">Volver al inicio →</a></main>;
}

export default function Router() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(window.location.search);
  let page;
  if (path === '/') page = <App />;
  else if (path === '/admin') page = <AdminPage />;
  else if (path.startsWith('/acceso/')) page = <AccessPage slug={decodeURIComponent(path.split('/')[2] || '')} />;
  else if (path.startsWith('/hub/')) page = <HubPage slug={decodeURIComponent(path.split('/')[2] || '')} preview={query.get('preview') === '1'} />;
  else page = <NotFound />;
  return <Suspense fallback={<div className="portal-status" role="status"><i /> Preparando la experiencia…</div>}>{page}</Suspense>;
}
