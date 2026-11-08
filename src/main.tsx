import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/piazzolla/700.css';
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/fragment-mono/400.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing from index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
