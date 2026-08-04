import { useCallback, useEffect, useRef, useState } from 'react';

const scriptId = 'cloudflare-turnstile-script';
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loadingPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const ready = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no está disponible.'));
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => reject(new Error('No se pudo cargar la verificación de seguridad.')), { once: true });
    const startedAt = Date.now();
    const poll = window.setInterval(() => {
      if (window.turnstile) { window.clearInterval(poll); resolve(window.turnstile); }
      else if (Date.now() - startedAt > 10000) { window.clearInterval(poll); reject(new Error('Turnstile tardó demasiado en responder.')); }
    }, 100);
  });
  return loadingPromise.catch(error => { loadingPromise = undefined; throw error; });
}

export function useTurnstile() {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const pendingRef = useRef(null);
  const completedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;
    let active = true;
    loadTurnstile().then(api => {
      if (!active || !containerRef.current) return;
      widgetRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        language: 'es',
        execution: 'execute',
        appearance: 'interaction-only',
        callback: token => { completedRef.current = true; pendingRef.current?.resolve(token); pendingRef.current = null; },
        'error-callback': () => { completedRef.current = true; pendingRef.current?.reject(new Error('No se pudo verificar tu navegador.')); pendingRef.current = null; },
        'expired-callback': () => { completedRef.current = true; pendingRef.current?.reject(new Error('La verificación expiró. Intenta nuevamente.')); pendingRef.current = null; },
      });
      setReady(true);
    }).catch(error => { pendingRef.current?.reject(error); pendingRef.current = null; });
    return () => {
      active = false;
      if (window.turnstile && widgetRef.current !== null) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
      completedRef.current = false;
    };
  }, [siteKey]);

  const execute = useCallback(() => {
    if (!siteKey) return Promise.reject(new Error('Falta configurar VITE_TURNSTILE_SITE_KEY.'));
    if (!ready || !window.turnstile || widgetRef.current === null) return Promise.reject(new Error('La verificación de seguridad aún se está preparando.'));
    if (pendingRef.current) return pendingRef.current.promise;
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
    pendingRef.current = { promise, resolve: resolvePromise, reject: rejectPromise };
    if (completedRef.current) {
      window.turnstile.reset(widgetRef.current);
      completedRef.current = false;
    }
    window.turnstile.execute(widgetRef.current);
    return promise;
  }, [ready, siteKey]);

  return { containerRef, execute, ready: ready || !siteKey };
}

export default function TurnstileSlot({ turnstile }) {
  return <div className="turnstile-slot" ref={turnstile.containerRef} aria-label="Verificación de seguridad" />;
}
