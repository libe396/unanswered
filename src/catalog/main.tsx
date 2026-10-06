import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Same self-hosted fonts and tokens as the exhibition (see src/main.tsx).
// global.css is deliberately not imported: it locks body scrolling for the
// Scene stage, and this page is one long scroll.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '../styles/tokens.css';
import { CatalogPage } from './CatalogPage';

createRoot(document.getElementById('catalog-root')!).render(
  <StrictMode>
    <CatalogPage />
  </StrictMode>,
);
