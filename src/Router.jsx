import App from './App.jsx';
import AccessPage from './AccessPage.jsx';
import HubPage from './HubPage.jsx';
import AdminPage from './AdminPage.jsx';

export default function Router() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(window.location.search);
  if (path === '/admin') return <AdminPage />;
  if (path.startsWith('/acceso/')) return <AccessPage slug={decodeURIComponent(path.split('/')[2] || '')} />;
  if (path.startsWith('/hub/')) return <HubPage slug={decodeURIComponent(path.split('/')[2] || '')} preview={query.get('preview') === '1'} />;
  return <App />;
}
