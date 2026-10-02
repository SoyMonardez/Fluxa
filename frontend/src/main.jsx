import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/instalar'; // escucha desde el arranque el aviso de "se puede instalar"
import './lib/actualizar'; // service worker: app disponible sin señal y actualizaciones
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
