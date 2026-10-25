import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/app.css';
import './styles/editor.css';
import './styles/db.css';
import App from './App';
import { initAnalytics } from './lib/analytics';

initAnalytics();
createRoot(document.getElementById('root')!).render(<App />);
