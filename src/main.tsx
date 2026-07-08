import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// اعتراض طلبات Fetch العالمية وحقن توكن الحماية تلقائياً لجميع مسارات السيرفر الحساسة
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem("pos_token");
  if (token) {
    init = init || {};
    init.headers = init.headers || {};
    if (init.headers instanceof Headers) {
      init.headers.set("Authorization", `Bearer ${token}`);
    } else if (Array.isArray(init.headers)) {
      const authExists = init.headers.some(h => h[0].toLowerCase() === 'authorization');
      if (!authExists) {
        init.headers.push(["Authorization", `Bearer ${token}`]);
      }
    } else {
      if (!(init.headers as any)["Authorization"] && !(init.headers as any)["authorization"]) {
        (init.headers as any)["Authorization"] = `Bearer ${token}`;
      }
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
