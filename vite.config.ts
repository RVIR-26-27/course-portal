import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Strict CSP for the production bundle only (the dev server needs inline HMR scripts).
function csp(supabaseUrl: string | undefined): Plugin {
  const supabase = supabaseUrl || 'https://*.supabase.co';
  const policy = [
    "default-src 'self'",
    `connect-src 'self' ${supabase}`,
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "style-src 'self'",
    "script-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return {
    name: 'portal-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

// GitHub Pages serves the portal from /<repository>/ ; set VITE_BASE when building.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), csp(process.env.VITE_SUPABASE_URL ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL)],
  build: { sourcemap: false, target: 'es2022' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
  },
}));
