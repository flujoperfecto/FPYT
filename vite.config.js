import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const requiredClientVariables = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_TURNSTILE_SITE_KEY',
];

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const fileEnvironment = loadEnv(mode, process.cwd(), 'VITE_');
    const environment = { ...fileEnvironment, ...process.env };
    const missing = requiredClientVariables.filter(name => !environment[name]?.trim());
    if (missing.length) {
      throw new Error(`Faltan variables públicas requeridas para el build: ${missing.join(', ')}`);
    }
  }

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  };
});
