import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/*
  Self-hosted webfonts. The exhibition machine may have no network, so nothing
  here may reach for a CDN — all three are npm packages bundled by Vite, all
  three are OFL.

  Pretendard is loaded as the single full variable file rather than the
  dynamic subset: the subset splits Korean across ~300 unicode-range files
  requested on demand, which is fine online and a source of missing glyphs
  offline.
*/
import 'pretendard/dist/web/variable/pretendardvariable.css'
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
