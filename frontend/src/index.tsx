// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';  // App이 default export되어 있어야 합니다

const root = ReactDOM.createRoot(
  document.getElementById('root')!
);
root.render(
  <App />
);
