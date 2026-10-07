// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://varshithregatte.com',
  integrations: [
    sitemap({
      // Transactional newsletter pages are noindex; keep them out of the sitemap too.
      filter: (page) => !/\/newsletter\/(check-email|confirm|confirmed)\/?$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});