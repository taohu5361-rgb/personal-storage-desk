import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeTheme } from './theme'
import { call } from './data/database'
import './theme.css'
import './styles.css'
import './styles/ui-system.css'
import './styles/pages-editor.css'

await initializeTheme()
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
)
if (window.__TAURI_INTERNALS__) await call('show_main_window')
