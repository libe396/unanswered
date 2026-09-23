import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/*
  Self-hosted webfonts. The exhibition machine may have no network, so nothing
  here may reach for a CDN — all three are npm packages bundled by Vite, all
  three are OFL.

  Pretendard uses the dynamic subset: 92 @font-face blocks, each with its own
  unicode-range, so the browser only fetches the slices whose glyphs are
  actually on screen instead of one 2MB file up front. Vite emits every slice
  into dist as a build asset, so this stays fully local — the split is about
  what gets *requested*, not about what ships.

  Same family name ('Pretendard Variable') as the full file, so --font-kr in
  tokens.css is unchanged.
*/
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
