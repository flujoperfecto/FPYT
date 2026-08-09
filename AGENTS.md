# Guía de continuidad para agentes — Flujo Perfecto

Este archivo es la fuente de contexto para retomar el proyecto. Léelo completo antes de modificar código, Supabase o contenido. No contiene secretos; nunca agregues contraseñas, tokens, claves privadas ni datos personales nuevos.

## 1. Propósito del producto

Flujo Perfecto es el hub complementario del canal de YouTube homónimo. Cada tutorial se convierte en una experiencia guiada con una línea de tiempo y materiales asociados a cada momento: prompts, instrucciones, skills, enlaces y archivos descargables.

El creador gestiona todo desde un panel protegido. Un tutorial puede tener dos modalidades de acceso:

- `public`: el visitante abre el hub directamente, sin entregar su email.
- `email`: el visitante completa la landing, acepta el consentimiento y obtiene acceso permanente al tutorial para su sesión anónima de Supabase.

El progreso se marca manualmente por momento y se guarda sólo en el navegador del suscriptor.

## 2. Estado verificado

Última verificación documentada: 9 de agosto de 2026.

- Proyecto Supabase: `FlujoPerfecto`.
- Project ref: `bomqxagomdseekmdcsdh`.
- Migraciones remotas aplicadas hasta `20260809044224_tutorial_slug_history.sql`. La última reserva cada slug anterior para su tutorial, mantiene redirecciones sin permitir reasignar enlaces y expone sólo una resolución exacta mediante RPC.
- El Cron `refresh-ai-news-daily` (`30 11 * * *`, job id 2) está **activo** desde el 2026-08-05, tras verificar una publicación manual exitosa.
- Edge Function `grant-tutorial-access` desplegada como versión 7 el 2026-08-09. Recibe el UUID estable del tutorial para que un rename durante el formulario no cambie el contenido concedido; conserva fallback por slug e historial para clientes antiguos. JWT sigue siendo obligatorio.
- Edge Function `refresh-ai-news` desplegada como versión 9 y activa, autenticada por una clave interna dedicada y conectada a Vault mediante `pg_net`. La URL, la clave de Cron y `DEEPSEEK_API_KEY` existen en Supabase.
  - Causa raíz de los fallos iniciales (v6): la llamada a DeepSeek forzaba `thinking: { type: "enabled" }` + `reasoning_effort: "high"` con `max_tokens: 4096`; el razonamiento agotaba el presupuesto de tokens antes de emitir el JSON final, produciendo timeout o contenido vacío. La v7 desactiva el modo thinking (`thinking: { type: "disabled" }`) para una tarea de curación/redacción que no lo necesita.
  - Bug adicional descubierto al diagnosticar (v8): el catch final sólo extraía `error.message` cuando `error instanceof Error`, colapsando cualquier otro valor lanzado a `"unknown_error"` y ocultando la causa real. Se añadió `describeError()` para serializar cualquier tipo de error lanzado.
  - Ese diagnóstico reveló un segundo bug real, en SQL: la función `private.ensure_ai_news_edition_complete()` (migración `20260805015357_ai_news_oracle.sql`) está compartida por los triggers de `ai_news_editions` y `ai_news_items`; en un `DELETE` sobre `ai_news_items` (el reemplazo idempotente que hace `publish_ai_news_edition` antes de insertar las 4 filas nuevas), `NEW` nunca está vinculado, y el código leía `new.edition_id` igualmente, lanzando `record "new" has no field "edition_id"`. Corregido en la migración `20260805031438_fix_ai_news_edition_complete_trigger.sql` (branching explícito por `TG_OP`/`TG_TABLE_NAME`, sin tocar `NEW` en `DELETE`).
  - Verificado el 2026-08-05: `npm run supabase:run-news-now` publicó una edición completa (4 ítems, 49 candidatos, 12 fuentes activas, modelo `deepseek-v4-pro`); se confirmó por SQL directo que la edición tiene 4 posiciones válidas con URLs `https://`.
  - Optimización de costo (2026-08-05): `DEEPSEEK_MODEL` pasó de `deepseek-v4-pro` a `deepseek-v4-flash`. Con thinking ya desactivado, esta tarea es clasificación/extracción estructurada sobre una lista corta pre-filtrada — el caso de uso recomendado para el nivel Flash. Precio por 1M tokens (cache-miss): Pro $0.435 input / $0.87 output vs Flash $0.14 input / $0.28 output (~3x más barato). Con ~16 candidatos en el prompt, el costo estimado por ejecución diaria baja de ~$0.0026 a ~$0.0009; a esta escala el gasto ya era marginal, pero Flash es la elección correcta para esta tarea de todas formas. Reescala a Pro sólo si la curación editorial empeora de forma perceptible.
- Datos reales después de limpiar fixtures: 1 tutorial, 1 capítulo, 1 recurso y 0 leads. Conteos verificados por SQL tras el pgTAP transaccional; no se dejaron fixtures.
- Suite pgTAP: 133/133 pruebas aprobadas contra el proyecto enlazado, antes y después de aplicar la migración. Incluye RLS, grants, historial de slugs, colisiones en INSERT/UPDATE, rename-back, cascada y resolución pública exacta.
- Pruebas unitarias de utilidades del cliente: 14/14 aprobadas (slugs, rutas, payload estable de acceso y allowlist de YouTube).
- Pruebas unitarias de Pulso IA: 9/9 aprobadas (RSS, Atom, límites, timeout, deduplicación, shortlist diverso y validación de DeepSeek).
- Build Vite aprobado (74 módulos) y `npm audit --omit=dev` sin vulnerabilidades.
- Lighthouse móvil sobre el build de producción: rendimiento 91, accesibilidad 96 y CLS 0 (2026-08-04).
- Mejora UX verificada: la portada prioriza la ruta disponible antes de Pulso IA; el acceso explica requisitos; el aula reanuda y sincroniza la línea de tiempo; el panel verifica YouTube, preserva borradores al refrescar y muestra una revisión de cambios antes de guardar.
- Repositorio desplegado en Vercel desde `main` con dominio canónico `https://www.flujoperfecto.com`, Node.js 22, `vercel.json`, fallback SPA, cabeceras seguras y `.vercelignore`.
- `APP_ORIGIN` de la Edge Function está configurado en Supabase como `https://www.flujoperfecto.com`; el preflight remoto de la versión 7 se verificó con respuesta 204 y el origen correcto el 2026-08-09.
- Cloudflare Turnstile tiene un widget de producción llamado `Flujo Perfecto Producción`, restringido a `www.flujoperfecto.com` y en modo Managed. La Site Key real está en Vercel y la Secret Key real sólo en Supabase Auth; ambas se configuraron el 2026-08-04 y nunca deben copiarse al repositorio.
- Supabase Auth usa `site_url = "https://www.flujoperfecto.com"`, conserva redirects locales para desarrollo y tiene CAPTCHA Turnstile activo desde `supabase/config.toml`. La configuración remota se aplicó con `supabase config push` y la variable privada `SUPABASE_AUTH_CAPTCHA_SECRET` sólo existió en memoria durante el comando.

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
  ├─ última edición de Pulso IA ──────────────> Supabase Database + RLS
  ├─ sesiones ───────────────────────────────> Supabase Auth
  ├─ archivos y portadas ────────────────────> Supabase Storage
  └─ concesión de acceso por email ──────────> Edge Function
                                                   └─ RPC transaccional

Supabase Cron + Vault
  └─ Edge Function refresh-ai-news
       ├─ feeds RSS/Atom oficiales y periodísticos
       ├─ DeepSeek para selección y resumen
       └─ RPC publish_ai_news_edition
```

## 4. Rutas y flujos

### Sitio público

- `/` y hashes `#inicio`, `#biblioteca`, `#aula`, `#metodo`: landing principal.
- La biblioteca obtiene tutoriales publicados desde Supabase.
- La sección aula de la portada es una demostración editorial construida con datos locales de `src/data.js`.
- La portada muestra la última edición publicada de `Pulso IA`. Si no existe o tiene más de 72 horas, usa los temas genéricos locales como reserva.

### Acceso de suscriptores

- `/acceso/:slug`: landing para tutoriales con `access_mode = 'email'`.
- `/materiales/:slug`: materiales ordenados del video, sin reproductor; es el enlace previsto para la descripción de YouTube.
- `/hub/:slug`: aula interactiva del tutorial.
- `/hub/:slug?preview=1`: vista previa privada; requiere una sesión de administrador y permite revisar borradores.

Flujo protegido:

1. La landing obtiene sólo metadatos del tutorial publicado.
2. Turnstile entrega un token.
3. Si no existe sesión, el cliente inicia una sesión anónima de Supabase Auth.
4. La Edge Function valida email, consentimiento, honeypot y límite de intentos.
5. La función resuelve el UUID estable y llama a `grant_tutorial_access` usando el cliente administrativo.
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
- `tutorial_slug_history`: slugs anteriores reservados por tutorial. Los clientes no pueden enumerarlos ni escribirlos; el trigger privado mantiene la tabla.
- `ai_news_editions`: edición diaria, modelo, cantidad de candidatos, publicación y metadatos de generación.
- `ai_news_items`: cuatro noticias ordenadas con resumen, utilidad, fuente principal y fuentes adicionales.

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
- Un slug histórico nunca puede asignarse a otro tutorial. `resolve_tutorial_slug(text)` es un `SECURITY DEFINER` público deliberado que sólo resuelve un alias exacto publicado; `anon` no tiene `SELECT` sobre la tabla. Los avisos del advisor sobre esta función son esperados y no deben resolverse abriendo la tabla.
- `refresh-ai-news` no confía en JWT públicos: exige `x-cron-secret`, compara la clave en tiempo constante y sólo escribe mediante `service_role` después de validar la edición completa.
- `publish_ai_news_edition` es `SECURITY INVOKER`, sólo puede ejecutarla `service_role`, exige exactamente cuatro posiciones válidas y reemplaza una fecha de forma atómica e idempotente.
- `anon` y `authenticated` sólo pueden leer ediciones publicadas; ningún cliente puede escribir noticias.
- El honeypot `website`, el consentimiento y el límite de 10 intentos por hora son deliberados. El conteo y registro del intento se hacen atómicamente en `check_and_record_access_attempt` (bloqueo consultivo por `user_id`) para evitar una condición de carrera entre solicitudes concurrentes de la misma sesión anónima.

Toda modificación de esquema debe hacerse con una migración nueva generada por Supabase CLI. No edites migraciones que ya estén aplicadas en remoto.

## 8. Mapa de archivos

```text
src/
  App.jsx             Landing, biblioteca, aula demostrativa y método.
  AccessPage.jsx      Captura de email y concesión de acceso.
  MaterialsPage.jsx   Materiales del video sin reproductor, con modales accesibles.
  HubPage.jsx         Aula real, materiales y progreso local. Reanuda el primer
                      momento incompleto y sincroniza el momento activo con
                      YouTube IFrame API sin recrear el reproductor al avanzar.
  AdminPage.jsx       Login y panel editorial. Dividido en subcomponentes internos
                      (AdminSidebar, AdminStats, VideoListPanel, VideoEditorHeader,
                      VideoForm, ChapterTimeline, ChapterEditorPanel, LeadsPanel)
                      desde 2026-08-04 para que el archivo siga siendo legible a
                      medida que crezca el panel; el estado y los handlers siguen
                      centralizados en AdminPage, los subcomponentes son de presentación.
  Router.jsx          Enrutamiento por pathname, carga diferida de rutas privadas
                      y experiencia 404 con identidad propia.
  PortalNotice.jsx    Experiencia compartida para errores y rutas retiradas.
  api.js              Capa de acceso a Supabase y operaciones de dominio.
                      Implementa también GET /api/news para la última edición pública.
                      También exporta RESOURCE_LABELS (mapa de tipo de recurso a
                      etiqueta) y copyText (copiar con fallback de <textarea>),
                      compartidos por AdminPage.jsx, HubPage.jsx y App.jsx para
                      evitar que cada pantalla reimplemente su propia versión.
  supabase.js         Cliente público persistente.
  Turnstile.jsx       Carga y ejecución explícita de Turnstile.
  BrandMark.jsx       Única fuente del logo visible.
  data.js             Contenido local de demostración de la landing.
  tutorialUtils.js    Slugs, rutas públicas, validación de YouTube y diff editorial.
  usePageMeta.js      Hook que actualiza título, meta description, canonical,
                      Open Graph/Twitter y robots por ruta. Mejora la corrección para
                      navegadores reales y rastreadores que ejecutan JavaScript
                      (Googlebot); NO resuelve la visibilidad para rastreadores de
                      IA sin JS (GPTBot, ClaudeBot, PerplexityBot) — eso requiere
                      prerenderizado/SSR, ver §13.
  styles.css          Landing y sistema visual principal.
  portal.css          Acceso, hub y administración.

public/images/
  flujo-perfecto-logo.jpg  Logo oficial del canal.
  flujo-hero.webp          Arte principal greco-tecnológico.
  flujo-library.webp       Arte de biblioteca/acceso.
  flujo-classroom.webp     Arte del aula y portada por defecto.
  flujo-oracle-desktop.webp  Hero Oráculo Vivo 1920×1080.
  flujo-oracle-mobile.webp   Composición móvil Oráculo Vivo 1080×1350.

public/robots.txt, public/sitemap.xml, public/llms.txt
  Añadidos el 2026-08-05 (auditoría SEO/GEO). sitemap.xml sólo lista rutas
  estáticas estables — ver nota dentro del archivo sobre por qué no incluye
  rutas de tutoriales todavía. Los tres necesitan `Content-Type` con charset
  explícito en `vercel.json` porque contienen texto no-ASCII (o para
  consistencia); no los sirvas sin esa cabecera.

supabase/
  migrations/         Historial inmutable del esquema.
  functions/grant-tutorial-access/index.ts
  functions/refresh-ai-news/  Recolección RSS/Atom, DeepSeek, validación y publicación.
  cron/               Ejecución manual, activación y desactivación del Cron diario.
  tests/hub_security_test.sql
  seed.sql

scripts/
  bootstrap-admin.mjs
  migrate-to-supabase.mjs
  verify-supabase.mjs
  smoke-access-flow.mjs
  smoke-admin-flow.mjs
  smoke-ai-news.mjs
  test-tutorial-utils.mjs
  test-ai-news.mjs

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
- La sección Método usa tres ilustraciones WebP escultóricas propias (`method-understand`, `method-build` y `method-launch`), inscripciones griegas, columnas, sello Φ y animaciones CSS de deriva, respiración y barrido compatibles con `prefers-reduced-motion`.
- La landing incorpora una capa de interacción en `PageEffects`: progreso de lectura, halo de puntero, parallax moderado del hero y revelado progresivo mediante `IntersectionObserver`. Sólo se activa visualmente; no condiciona el acceso al contenido y respeta `prefers-reduced-motion`.
- El hero `Oráculo Vivo` usa composiciones separadas de escritorio y móvil, tres planos CSS/SVG y desplazamientos máximos de 6/12/18 px mediante `requestAnimationFrame`; deja de actualizarse cuando sale del viewport.
- `AiNewsTicker` reserva su altura, puede pausarse y abre `NewsDrawer` con trampa de foco, cierre por Escape y devolución del foco. En móvil no se anima automáticamente.
- La cuadrícula de Biblioteca es fluida y permite que un único tutorial utilice todo el ancho disponible. El panel lateral de recursos atrapa el foco, responde a Escape y devuelve el foco al control que lo abrió.
- La experiencia `Ruta Viva` usa violeta para el momento activo, verde ácido para progreso/siguiente acción y tonos neutros para lo pendiente. En móvil el progreso del aula permanece visible y los controles operativos mantienen objetivos táctiles de al menos 44 px.
- La línea de tiempo del aula sigue la reproducción mediante YouTube IFrame API; los cambios manuales usan `seekTo` para no recrear el iframe. Si la API tarda o falla, se conserva un iframe directo de `youtube-nocookie.com`.

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

Secretos exclusivos de Supabase Edge Functions, nunca de Vercel:

```text
DEEPSEEK_API_KEY
AI_NEWS_CRON_SECRET
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
npm run test:ai-news
npm run supabase:run-news-now
npm run supabase:smoke-news
npm run supabase:activate-news-cron
npm run supabase:disable-news-cron
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

- Si se rota el widget Turnstile, actualiza coordinadamente `VITE_TURNSTILE_SITE_KEY` en Vercel y `SUPABASE_AUTH_CAPTCHA_SECRET` al ejecutar `supabase config push`; nunca guardes la Secret Key en archivos versionados.
- `APP_ORIGIN` acepta deliberadamente un único origen exacto. Si cambia el dominio canónico, actualiza el secreto de Supabase y verifica el preflight antes de publicar el cambio.
- La protección de contraseñas filtradas de Supabase debe habilitarse desde la configuración de Auth si el plan lo permite.
- El progreso vive en `localStorage`; no se sincroniza entre dispositivos ni usuarios.
- El router manual necesita fallback SPA. En Vercel ya está resuelto mediante `vercel.json`; cualquier otro hosting debe aplicar una regla equivalente hacia `index.html`.
- Los previews dinámicos de Vercel no pueden completar de forma segura los flujos protegidos con la configuración de producción: la Edge Function usa un único `APP_ORIGIN` exacto y Turnstile restringe hostnames. Para QA completo usa un origen estable y servicios de staging separados.
- Antes de publicar, verifica políticas de privacidad, consentimiento y mecanismo de baja para comunicaciones.
- La Edge Function `grant-tutorial-access` quedó desplegada como versión 7 el 2026-08-09 después de aplicar `20260809044224_tutorial_slug_history.sql`. En cambios futuros recuerda que `db push` sólo sincroniza SQL y que el código TypeScript requiere desplegar la función por separado.
- El directorio `server/` se eliminó el 2026-08-04: estaba vacío y podía sugerir a un futuro agente que existe un backend Node propio, contradiciendo la arquitectura descrita en §3. Si en algún momento se necesita un proceso Node server-side, créalo de nuevo con contenido real, no como placeholder.
- Las versiones de `react`, `react-dom`, `vite` y `@vitejs/plugin-react` en `package.json` se fijaron a las versiones instaladas (antes usaban `"latest"`) el 2026-08-04, para que `npm install` sea reproducible entre máquinas y no arrastre un mayor sin aviso. Súbelas deliberadamente cuando quieras actualizar, revisando notas de cambios.
- Pulso IA conserva la última edición cuando una fuente o DeepSeek falla. `supabase:run-news-now` ya publicó cuatro filas válidas el 2026-08-05 (verificado por SQL directo, equivalente a `supabase:smoke-news`). El Cron `refresh-ai-news-daily` está **activo** desde el 2026-08-05.
- La lista versionada de feeds conserva únicamente endpoints estables verificados. Anthropic y Meta figuran como pendientes en el código porque no publican actualmente un RSS/Atom oficial estable; no los sustituyas por agregadores de terceros sin una decisión editorial explícita.
- El panel muestra la miniatura real de YouTube junto a cada URL para detectar desalineaciones editoriales antes de publicar. La verificación es deliberadamente visual: no cambies automáticamente títulos, capítulos ni URLs remotas basándote sólo en metadatos de YouTube.
- **Auditoría SEO/GEO (2026-08-05).** Hallazgo central: el sitio es una SPA 100% client-side sin prerenderizado — el HTML inicial no contiene texto, sólo `<title>`. Cualquier rastreador que no ejecute JavaScript (GPTBot, ClaudeBot, PerplexityBot, y cualquier indexador de primera pasada) ve una página en blanco. `site:flujoperfecto.com` devolvía 0 resultados en Google el día de la auditoría (el sitio llevaba 1 día desplegado, así que parte de eso es esperable, pero sin sitemap ni robots.txt tampoco había señal de descubrimiento).
  - Corregido: `public/robots.txt`, `public/sitemap.xml` (sólo `/` por ahora), `public/llms.txt`, JSON-LD Organization+WebSite, Open Graph/Twitter y `src/usePageMeta.js`. `/admin`, previews, 404 y contenido publicado vacío usan `noindex`.
  - **No corregido — requiere decisión o trabajo mayor:**
    1. Prerenderizado o SSR real. Es la dependencia de todo lo demás para GEO; `usePageMeta.js` sólo ayuda a navegadores reales y rastreadores que sí ejecutan JS.
    2. El único tutorial publicado (`idea-a-app-con-ia`) tiene `access_mode = 'email'`, así que ni siquiera con el renderizado resuelto habría contenido de tutorial públicamente indexable — RLS bloquea capítulos/recursos sin sesión con acceso concedido. Decisión de producto pendiente: reservar 1-2 tutoriales ancla como `public` para atraer tráfico orgánico.
    3. `sitemap.xml` es estático a propósito (ver comentario en el archivo) — no lo llenes a mano con slugs de tutoriales; conviértelo en generación dinámica en build cuando se aborde el prerenderizado.
    4. No se añadió un `<link rel="canonical">` estático en `index.html` a propósito: como el fallback SPA sirve el mismo HTML para cualquier ruta, un canonical fijo apuntando a `/` declararía incorrectamente que todas las rutas son duplicados de la home. `usePageMeta.js` ya lo corrige dinámicamente por ruta; no reintroduzcas uno estático sin resolver esto primero.
  - Auditoría completa (keywords, on-page, técnico, competencia, plan priorizado) publicada como artefacto durante la sesión; pide el enlace si se necesita retomarla.
  - **Trabajo de contenido pendiente, bloqueado deliberadamente**: construir el clúster de páginas sobre Claude Code, Claude Cowork y ChatGPT Codex (pilar + comparativas + glosario, detallado en la auditoría) espera a que existan los videos correspondientes en YouTube. No generes estas páginas de forma especulativa sin un video real que acompañar — cada tutorial del hub nace de un video publicado, no al revés. Retómalo cuando el usuario confirme que ya hay video(s) de ChatGPT y/o Claude disponibles en el canal.
  - Actualización 2026-08-08: los tutoriales nuevos nacen con `access_mode = 'public'` y existe `/materiales/:slug`, una vista sin reproductor pensada para el tráfico que llega desde la descripción de YouTube. Es la ruta con más potencial de indexación del sitio, así que cuando se aborde el prerenderizado empieza por ahí.
