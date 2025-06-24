// src/index.tsx
import React from 'react';
import './index.css';
import App from './App';  // App이 default export되어 있어야 합니다

// @ts-ignore
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <App />
);
