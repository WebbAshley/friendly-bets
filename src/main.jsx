import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import PrivacyPolicy from './PrivacyPolicy.jsx'
import Terms from './Terms.jsx'

const path = window.location.pathname;
let Component = App;
if (path === '/privacy') Component = PrivacyPolicy;
if (path === '/terms') Component = Terms;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Component />
  </StrictMode>,
)
