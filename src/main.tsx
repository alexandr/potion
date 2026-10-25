import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/app.css';
import './styles/editor.css';
import './styles/db.css';
import App from './App';

// GitHub Pages SPA redirect (see public/404.html)
createRoot(document.getElementById('root')!).render(<App />);
