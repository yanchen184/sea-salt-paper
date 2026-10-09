import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { MotionToggle } from './app/MotionToggle'
import { ThemeToggle } from './app/ThemeToggle'
import { applyTheme, loadTheme } from './lib/theme'

applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="fixed right-3 top-3 z-10 flex items-center gap-2">
      <MotionToggle />
      <ThemeToggle />
    </div>
    <App />
  </StrictMode>,
)
