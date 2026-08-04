# Guía de continuidad para agentes — Flujo Perfecto

Este archivo es la fuente de contexto para retomar el proyecto. Léelo completo antes de modificar código, Supabase o contenido. No contiene secretos; nunca agregues contraseñas, tokens, claves privadas ni datos personales nuevos.

## 1. Propósito del producto

Flujo Perfecto es el hub complementario del canal de YouTube homónimo. Cada tutorial se convierte en una experiencia guiada con una línea de tiempo y materiales asociados a cada momento: prompts, instrucciones, skills, enlaces y archivos descargables.

El creador gestiona todo desde un panel protegido. Un tutorial puede tener dos modalidades de acceso:

- `public`: el visitante abre el hub directamente, sin entregar su email.
- `email`: el visitante completa la landing, acepta el consentimiento y obtiene acceso permanente al tutorial para su sesión anónima de Supabase.

El progreso se marca manualmente por momento y se guarda sólo en el navegador del suscriptor.

## 2. Estado verificado

Última verificación documentada: 4 de agosto de 2026.

- Proyecto Supabase: `FlujoPerfecto`.
- Project ref: `bomqxagomdseekmdcsdh`.
- Migraciones remotas aplicadas hasta `20260804200000_atomic_access_attempts.sql` (agrega `check_and_record_access_attempt`, ver §7). Aplicada y reverificada con `npx supabase test db --linked` (68/68 pruebas en verde).
- Edge Function `grant-tutorial-access` desplegada como versión 2 el 2026-08-04. El código remoto ya llama a `check_and_record_access_attempt`; la migración y la función están sincronizadas.
- Datos reales después de limpiar fixtures: 1 tutorial, 4 capítulos, 4 recursos y 1 lead.
- Suite pgTAP: 68 pruebas aprobadas.
- Build Vite aprobado y `npm audit --omit=dev` sin vulnerabilidades.
- Repositorio desplegado en Vercel desde `main` con dominio canónico `https://www.flujoperfecto.com`, Node.js 22, `vercel.json`, fallback SPA, cabeceras seguras y `.vercelignore`.
- `APP_ORIGIN` de la Edge Function está configurado en Supabase como `https://www.flujoperfecto.com`; el preflight remoto se verificó con respuesta 204 y el origen correcto el 2026-08-04.

No des por permanentes estos conteos: compruébalos con `npm run supabase:verify` cuando dispongas de las variables privadas requeridas.

## 3. Stack y arquitectura

- React con JSX y React DOM.
- Vite para desarrollo y build.
- CSS propio, sin framework de componentes.
- `@supabase/supabase-js` para Database, Auth, Storage y Edge Functions.
- Supabase CLI para migraciones, funciones y pruebas.
- Cloudflare Turnstile integrado en el acceso por email y el login administrativo.
- Vercel es el hosting previsto para el frontend estático; no aloja el código de `supabase/functions/`.

No existe un servidor Express ni endpoints HTTP propios. `src/api.js` es una capa de compatibilidad dentro del navegador: recibe rutas con forma `/api/...` y las traduce a operaciones directas de Supabase. No intentes buscar un backend Node para esas rutas.

El enrutamiento también es intencionalmente sencillo: `src/Router.jsx` interpreta `window.location.pathname`; no se usa React Router.

```text
Navegador React
  ├─ consultas públicas y de administrador ──> Supabase Database + RLS
  ├─ sesiones ───────────────────────────────> Supabase Auth
  ├─ archivos y portadas ────────────────────> Supabase Storage
  └─ concesión de acceso por email ──────────> Edge Function
                                                   └─ RPC transaccional
```

## 4. Rutas y flujos

### Sitio público

- `/` y hashes `#inicio`, `#biblioteca`, `#aula`, `#metodo`: landing principal.
- La biblioteca obtiene tutoriales publicados desde Supabase.
- La sección aula de la portada es una demostración editorial construida con datos locales de `src/data.js`.

### Acceso de suscriptores

- `/acceso/:slug`: landing para tutoriales con `access_mode = 'email'`.
- `/hub/:slug`: aula interactiva del tutorial.
- `/hub/:slug?preview=1`: vista previa privada; requiere una sesión de administrador y permite revisar borradores.

Flujo protegido:

1. La landing obtiene sólo metadatos del tutorial publicado.
2. Turnstile entrega un token.
3. Si no existe sesión, el cliente inicia una sesión anónima de Supabase Auth.
4. La Edge Function valida email, consentimiento, honeypot y límite de intentos.
5. La función llama a `grant_tutorial_access` usando el cliente administrativo.
6. Se crean o actualizan `leads` y `tutorial_access` de forma atómica.
7. RLS permite leer capítulos, recursos y archivos de ese tutorial.

Los tutoriales públicos omiten este flujo y abren el hub directamente.

### Administración

- `/admin`: login y panel protegido.
- El usuario debe autenticarse con email/contraseña y tener una fila propia en `admin_users`.
- El panel permite crear, editar, publicar, filtrar, duplicar y eliminar tutoriales; subir portadas; crear, ordenar, duplicar y eliminar capítulos; añadir, ordenar y eliminar recursos; y revocar leads.
- Cambiar estado o modalidad de acceso exige confirmación visual.
- Las operaciones de orden usan RPCs transaccionales para no violar los índices únicos de posición.

## 5. Modelo de datos

Tablas públicas:

- `admin_users`: allowlist de administradores vinculada a `auth.users`.
- `tutorials`: título, slug, descripción, YouTube, portada, estado, modalidad de acceso y contadores.
- `chapters`: momentos ordenados por `position`, con `start_seconds`.
- `resources`: materiales ordenados; tipos válidos `prompt`, `instruction`, `skill`, `link`, `file`.
- `leads`: email normalizado, nombre, consentimiento y tutorial.
- `tutorial_access`: relación entre usuario autenticado, tutorial y lead.
- `access_attempts`: registro temporal para limitar concesiones de acceso.

Relaciones principales:

```text
tutorials
  ├─ chapters
  │    └─ resources
  ├─ leads
  └─ tutorial_access ──> auth.users

auth.users
  └─ admin_users
```

Los deletes de tutoriales y capítulos usan cascada en Postgres. Los contadores `chapter_count` y `resource_count`, junto con `updated_at`, se mantienen mediante triggers privados.

## 6. Storage

- `tutorial-materials`: bucket privado, máximo 25 MiB. Los archivos se descargan mediante URLs firmadas de cinco minutos. RLS permite lectura al suscriptor con acceso y gestión completa al administrador.
- `tutorial-covers`: bucket público, máximo 8 MiB y restringido a JPEG, PNG, WebP o AVIF. Sólo administradores pueden gestionarlo.

Al eliminar contenido, limpia también sus objetos de Storage. `src/api.js` ya implementa esta limpieza y devuelve una advertencia si la fila fue eliminada pero algún objeto requiere revisión manual.

## 7. Seguridad que no debe romperse

- RLS debe seguir activo en todas las tablas expuestas.
- Los borradores nunca son visibles públicamente.
- Los metadatos de tutoriales publicados pueden ser públicos; capítulos y recursos protegidos no.
- Un suscriptor sólo puede ver sus propias filas de acceso y nunca puede leer leads ni administradores.
- `grant_tutorial_access` sólo puede ejecutarlo `service_role`.
- Los RPCs `reorder_chapters` y `reorder_resources` son `SECURITY INVOKER`, exigen administrador y validan que se suministre cada hijo exactamente una vez.
- Las claves `SUPABASE_SECRET_KEY`, contraseñas administrativas y secretos de Turnstile nunca llevan prefijo `VITE_` ni se guardan en el repositorio.
- La Edge Function acepta únicamente `APP_ORIGIN` como origen CORS.
- El honeypot `website`, el consentimiento y el límite de 10 intentos por hora son deliberados. El conteo y registro del intento se hacen atómicamente en `check_and_record_access_attempt` (bloqueo consultivo por `user_id`) para evitar una condición de carrera entre solicitudes concurrentes de la misma sesión anónima.

Toda modificación de esquema debe hacerse con una migración nueva generada por Supabase CLI. No edites migraciones que ya estén aplicadas en remoto.

## 8. Mapa de archivos

```text
src/
  App.jsx             Landing, biblioteca, aula demostrativa y método.
  AccessPage.jsx      Captura de email y concesión de acceso.
  HubPage.jsx         Aula real, materiales y progreso local.
  AdminPage.jsx       Login y panel editorial. Dividido en subcomponentes internos
                      (AdminSidebar, AdminStats, VideoListPanel, VideoEditorHeader,
                      VideoForm, ChapterTimeline, ChapterEditorPanel, LeadsPanel)
                      desde 2026-08-04 para que el archivo siga siendo legible a
                      medida que crezca el panel; el estado y los handlers siguen
                      centralizados en AdminPage, los subcomponentes son de presentación.
  Router.jsx          Enrutamiento por pathname.
  api.js              Capa de acceso a Supabase y operaciones de dominio.
                      También exporta RESOURCE_LABELS (mapa de tipo de recurso a
                      etiqueta) y copyText (copiar con fallback de <textarea>),
                      compartidos por AdminPage.jsx, HubPage.jsx y App.jsx para
                      evitar que cada pantalla reimplemente su propia versión.
  supabase.js         Cliente público persistente.
  Turnstile.jsx       Carga y ejecución explícita de Turnstile.
  BrandMark.jsx       Única fuente del logo visible.
  data.js             Contenido local de demostración de la landing.
  styles.css          Landing y sistema visual principal.
  portal.css          Acceso, hub y administración.

public/images/
  flujo-perfecto-logo.jpg  Logo oficial del canal.
  flujo-hero.webp          Arte principal greco-tecnológico.
  flujo-library.webp       Arte de biblioteca/acceso.
  flujo-classroom.webp     Arte del aula y portada por defecto.

supabase/
  migrations/         Historial inmutable del esquema.
  functions/grant-tutorial-access/index.ts
  tests/hub_security_test.sql
  seed.sql

scripts/
  bootstrap-admin.mjs
  migrate-to-supabase.mjs
  verify-supabase.mjs
  smoke-access-flow.mjs
  smoke-admin-flow.mjs

vercel.json         Build Vite, salida dist, cabeceras y rewrite SPA.
.vercelignore       Excluye infraestructura y archivos locales del upload.
VERCEL.md           Checklist de dominio, variables, Supabase y Turnstile.
```

## 9. Sistema visual

La marca combina Grecia clásica con tecnología/IA:

- Fondos negros y violetas, acentos lila y verde ácido para estados positivos.
- Estatuas, templos, geometría, redes, circuitos y energía violeta.
- Tipografía sans de gran escala combinada con cursiva serif editorial.
- Bordes finos, retículas, numeración monoespaciada y brillo controlado.
- La sección Método usa iconos SVG propios, inscripciones griegas, columnas, sello Φ y animaciones compatibles con `prefers-reduced-motion`.
- La landing incorpora una capa de interacción en `PageEffects`: progreso de lectura, halo de puntero, parallax moderado del hero y revelado progresivo mediante `IntersectionObserver`. Sólo se activa visualmente; no condiciona el acceso al contenido y respeta `prefers-reduced-motion`.
- La cuadrícula de Biblioteca es fluida y permite que un único tutorial utilice todo el ancho disponible. El panel lateral de recursos atrapa el foco, responde a Escape y devuelve el foco al control que lo abrió.

No reemplaces esta identidad por tarjetas genéricas, degradados arbitrarios o iconos de librería sin adaptación. Reutiliza `BrandMark.jsx` para el logo; no dupliques su marcado.

El usuario pidió explícitamente no utilizar la skill de creación de sitios para este proyecto. Respeta esa preferencia salvo que el usuario la revoque después de forma clara.

## 10. Variables de entorno

Variables públicas del frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_TURNSTILE_SITE_KEY
```

Variables de proceso para scripts o despliegues (la secret key y las contraseñas sí son privadas):

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
APP_ORIGIN
```

Usa `.env.example` como referencia. La `.env` local no debe contener claves administrativas si no son necesarias. Los scripts Node no cargan `.env` automáticamente: las variables privadas deben existir en el proceso que los ejecuta.

## 11. Comandos habituales

```bash
npm install
npm run dev
npm run build
npm audit --omit=dev
```

Supabase:

```bash
npx supabase link --project-ref bomqxagomdseekmdcsdh
npx supabase db push --linked --dry-run
npx supabase db advisors --linked --type all --level warn --fail-on error
npx supabase db lint --linked
npx supabase db push --linked
npx supabase migration list --linked
npx supabase test db --linked
```

Verificación funcional, con las variables privadas cargadas sólo en el proceso:

```bash
npm run supabase:verify
npm run supabase:smoke-access
npm run supabase:smoke-admin
```

Los smoke tests crean fixtures aislados y deben limpiarlos incluso si fallan. Comprueba los conteos reales al terminar.

## 12. Flujo recomendado para continuar

1. Lee este archivo y `README.md`.
2. Ejecuta `rg --files -g "!node_modules/**" -g "!dist/**"` y revisa cambios existentes antes de editar.
3. Confirma que `.mcp.json` y el proyecto enlazado apuntan al project ref esperado.
4. Si el trabajo toca Supabase, revisa RLS y privilegios antes de implementar.
5. Mantén `src/api.js` como frontera de operaciones de dominio.
6. Genera migraciones nuevas con la CLI y haz primero un dry run.
7. Ejecuta build, auditoría, pgTAP y smoke tests en proporción al cambio.
8. Haz revisión visual de las rutas afectadas en escritorio y móvil.
9. Elimina fixtures y archivos temporales de Storage.
10. Documenta aquí cualquier decisión arquitectónica que un agente futuro necesite conocer.

## 13. Riesgos y decisiones pendientes

- Falta configurar las claves reales de Turnstile y las URLs de Auth para el dominio definitivo antes de producción.
- `APP_ORIGIN` acepta deliberadamente un único origen exacto. Si cambia el dominio canónico, actualiza el secreto de Supabase y verifica el preflight antes de publicar el cambio.
- La protección de contraseñas filtradas de Supabase debe habilitarse desde la configuración de Auth si el plan lo permite.
- El progreso vive en `localStorage`; no se sincroniza entre dispositivos ni usuarios.
- El router manual necesita fallback SPA. En Vercel ya está resuelto mediante `vercel.json`; cualquier otro hosting debe aplicar una regla equivalente hacia `index.html`.
- Los previews dinámicos de Vercel no pueden completar de forma segura los flujos protegidos con la configuración de producción: la Edge Function usa un único `APP_ORIGIN` exacto y Turnstile restringe hostnames. Para QA completo usa un origen estable y servicios de staging separados.
- Antes de publicar, verifica políticas de privacidad, consentimiento y mecanismo de baja para comunicaciones.
- La Edge Function se redesplegó como versión 2 el 2026-08-04 después de aplicar `20260804200000_atomic_access_attempts.sql`. En cambios futuros recuerda que `db push` sólo sincroniza SQL y que el código TypeScript requiere `npx supabase functions deploy grant-tutorial-access` por separado.
- El directorio `server/` se eliminó el 2026-08-04: estaba vacío y podía sugerir a un futuro agente que existe un backend Node propio, contradiciendo la arquitectura descrita en §3. Si en algún momento se necesita un proceso Node server-side, créalo de nuevo con contenido real, no como placeholder.
- Las versiones de `react`, `react-dom`, `vite` y `@vitejs/plugin-react` en `package.json` se fijaron a las versiones instaladas (antes usaban `"latest"`) el 2026-08-04, para que `npm install` sea reproducible entre máquinas y no arrastre un mayor sin aviso. Súbelas deliberadamente cuando quieras actualizar, revisando notas de cambios.
