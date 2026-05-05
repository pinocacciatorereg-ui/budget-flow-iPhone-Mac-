import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Entry point: mount the App component onto the root element
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);