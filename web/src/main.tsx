import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GameProvider } from './theme';
import 'candy-ui/style.css';
import './styles.css';
import './layout.css';

const root = document.getElementById('root');
if (!root) throw new Error('页面入口不存在');
createRoot(root).render(<React.StrictMode><GameProvider><App /></GameProvider></React.StrictMode>);
