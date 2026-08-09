import { useEffect } from 'react';

const SITE_ORIGIN = 'https://www.flujoperfecto.com';
const DEFAULT_TITLE = 'Flujo Perfecto — Diseña sistemas con IA que trabajan por ti';
const DEFAULT_DESCRIPTION = 'No aprendas IA para saber hablar de ella. Tutoriales en español para diseñar sistemas que eliminan tareas repetitivas y siguen funcionando aunque cambien las herramientas.';

function upsertMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href) {
  let tag = document.head.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

// Actualiza título, meta description, canonical y Open Graph/Twitter por ruta.
// Es una mejora incremental para navegadores reales y rastreadores que ejecutan
// JavaScript (Googlebot); no sustituye al prerenderizado que necesitan los
// rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot), que no ejecutan JS.
export default function usePageMeta({ title, description = DEFAULT_DESCRIPTION, path = '/', noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Flujo Perfecto` : DEFAULT_TITLE;
    const canonicalUrl = `${SITE_ORIGIN}${path === '/' ? '' : path}`;

    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertCanonical(canonicalUrl);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'Flujo Perfecto');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);

    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta('name', 'description', DEFAULT_DESCRIPTION);
      upsertMeta('name', 'robots', 'index, follow');
      upsertCanonical(SITE_ORIGIN);
    };
  }, [title, description, path, noindex]);
}
