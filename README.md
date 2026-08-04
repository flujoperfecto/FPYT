# Flujo Perfecto

Hub de tutoriales de YouTube con capítulos, prompts, instrucciones, skills, enlaces y archivos descargables. La aplicación React usa Supabase directamente para Database, Auth y Storage; la concesión de acceso por email pasa por una Edge Function.

Para retomar el desarrollo, decisiones de arquitectura, mapa completo de archivos, invariantes de seguridad y checklist de entrega, consulta [`AGENTS.md`](./AGENTS.md).

## Arquitectura

- Los tutoriales pueden ser `public` o solicitar email.
- Los visitantes usan sesiones anónimas persistentes de Supabase Auth.
- Los administradores ingresan con email y contraseña y deben pertenecer a `admin_users`.
- RLS protege borradores, capítulos, recursos, suscriptores y accesos.
- El bucket `tutorial-materials` es privado y las descargas usan URLs firmadas de cinco minutos.
- El progreso se conserva en el navegador del suscriptor.
- Turnstile protege el alta anónima y el login administrativo cuando Auth está configurado con una clave secreta real de Cloudflare.

## Configuración local

1. Copia `.env.example` a `.env` y completa las tres variables `VITE_*`.
2. Instala dependencias con `npm install`.
3. Inicia la aplicación con `npm run dev`.
4. Genera el build con `npm run build`.

El build valida que existan `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_TURNSTILE_SITE_KEY`; así un deployment no puede publicarse silenciosamente sin su configuración mínima.

Rutas principales:

- `/acceso/:slug`: captura de email para contenidos protegidos.
- `/hub/:slug`: aula interactiva con línea de tiempo y materiales.
- `/admin`: gestión de tutoriales, momentos, recursos y suscriptores.

## Desplegar en Vercel

El repositorio incluye `vercel.json`, fallback SPA para rutas profundas, Node.js 22, cabeceras de seguridad y exclusiones de despliegue. Sigue el checklist completo en [`VERCEL.md`](./VERCEL.md).

## Provisionar Supabase

El código de infraestructura está en `supabase/`.

El archivo `.mcp.json` habilita el servidor oficial de Supabase limitado al proyecto `FlujoPerfecto`. La primera conexión requiere autorizar por OAuth la organización correcta.

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase secrets set APP_ORIGIN=https://tu-dominio.com
npx supabase functions deploy grant-tutorial-access
```

Anonymous Sign-Ins ya está activo. Antes de publicar, configura Cloudflare Turnstile con la clave secreta del dominio definitivo y reemplaza la site key de prueba local en `.env`. Añade también el dominio definitivo a las URLs permitidas de Auth.

Para crear o actualizar la primera cuenta administrativa, carga temporalmente las variables no públicas de `.env.example` en tu terminal y ejecuta:

```bash
npm run supabase:bootstrap-admin
```

`SUPABASE_SECRET_KEY` y `ADMIN_PASSWORD` nunca deben tener el prefijo `VITE_`, publicarse ni guardarse en el repositorio.

## Pruebas de seguridad

`supabase/tests/hub_security_test.sql` contiene 68 comprobaciones de esquema, privilegios, RLS y Storage. Puede ejecutarse contra el proyecto enlazado con Docker Desktop activo:

```bash
npx supabase test db --linked
```

O con Docker Desktop activo y la pila local iniciada:

```bash
npx supabase start
npm run supabase:test-db
```

## Migrar los datos actuales

El importador conserva IDs, slugs, textos, fechas y archivos existentes. Es idempotente y no crea accesos desde las cookies antiguas, por lo que cada suscriptor existente ingresará su correo una vez en el nuevo sistema.

```bash
npm run supabase:migrate-data
npm run supabase:verify
```

Con CAPTCHA desactivado o usando las claves oficiales de prueba de Turnstile en desarrollo, `npm run supabase:smoke-access` prueba Auth anónima, la Edge Function y el cambio de visibilidad RLS antes/después del grant. El script elimina su usuario y lead temporales al terminar. Las claves de prueba no protegen un despliegue público.

Por defecto lee `data/hub.json` y `storage/uploads`. Se pueden cambiar con `DATA_FILE` y `UPLOADS_DIR`. Conserva esos directorios como respaldo hasta validar los conteos y todos los flujos.
