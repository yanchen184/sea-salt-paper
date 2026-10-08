import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeToggle } from './app/ThemeToggle'
import { applyTheme, loadTheme } from './lib/theme'

applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeToggle />
    <App />
  </StrictMode>,
)
