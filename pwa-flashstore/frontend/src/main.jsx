import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Hide loading screen when app loads
window.addEventListener('load', () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)