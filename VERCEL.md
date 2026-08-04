# Despliegue en Vercel

El repositorio está preparado como una SPA de Vite. `vercel.json` fija el build, la salida `dist`, las cabeceras HTTP y el fallback a `index.html` necesario para abrir directamente `/admin`, `/acceso/:slug` y `/hub/:slug`.

## 1. Proyecto conectado

El proyecto está desplegado desde `flujoperfecto/FPYT` y publica `main` en `https://www.flujoperfecto.com`. La configuración versionada define:

1. La raíz del repositorio como Root Directory.
2. Framework `Vite`.
3. Los siguientes valores de compilación:
   - Node.js `22.x`.
   - Build Command: `npm run build`.
   - Output Directory: `dist`.
   - Production Branch: `main`.

## 2. Variables del frontend

Configura estas tres variables en **Production** antes del primer build:

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL pública del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key pública de Supabase |
| `VITE_TURNSTILE_SITE_KEY` | Site key del widget Turnstile de producción |

Son valores compilados dentro del frontend. No agregues a Vercel `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD`, la secret key de Turnstile ni ninguna clave `service_role`.

El build falla deliberadamente si falta alguna variable `VITE_*` requerida. Cambiar variables en Vercel exige crear un nuevo deployment.

## 3. Configurar el origen definitivo

El origen canónico de producción es `https://www.flujoperfecto.com`, sin `/` final. El mismo origen debe configurarse en estos tres lugares:

1. **Supabase Edge Functions**

   ```bash
   npx supabase secrets set APP_ORIGIN=https://www.flujoperfecto.com --project-ref bomqxagomdseekmdcsdh
   ```

2. **Supabase Auth → URL Configuration**
   - Site URL: `https://www.flujoperfecto.com`
   - Redirect URL permitida: `https://www.flujoperfecto.com/**`

3. **Cloudflare Turnstile → Hostname Management**
   - Añade `www.flujoperfecto.com`, sólo como hostname, sin protocolo, puerto ni ruta.
   - Usa un widget distinto para desarrollo y producción.
   - No autorices `vercel.app` como dominio raíz compartido.

La validación servidor de Turnstile la realiza Supabase Auth al crear la sesión anónima; la secret key del widget debe permanecer configurada allí, nunca en el navegador.

## 4. Preview deployments

La Edge Function acepta un único `APP_ORIGIN` exacto y Turnstile restringe hostnames. Por seguridad, los previews dinámicos de Vercel no deben reutilizar la configuración de producción.

- La landing y los tutoriales públicos pueden revisarse en Preview.
- Para probar login administrativo o acceso por email en Preview, usa un proyecto Supabase de staging, otro widget Turnstile y un origen estable propio de staging.
- No abras la política CORS a `*.vercel.app` ni autorices el dominio raíz compartido de Vercel.

## 5. Comprobaciones posteriores

Después del deployment de producción verifica:

- `/`, `/admin`, `/acceso/idea-a-app-con-ia` y `/hub/idea-a-app-con-ia` cargan también al refrescar la página.
- La Biblioteca obtiene el tutorial publicado.
- Turnstile permite crear una sesión anónima.
- El acceso por email abre capítulos y recursos protegidos.
- El administrador puede iniciar sesión, subir una portada y cerrar sesión.
- Los archivos privados se descargan mediante una URL firmada temporal.
- Las respuestas incluyen `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.

Cuando Vercel quede conectado a GitHub, cada push a `main` generará un deployment de producción y las ramas adicionales producirán previews.
