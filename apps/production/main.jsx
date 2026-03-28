import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './src/App'

// Mock storage dla artifact storage
window.storage = {
  get: (key) => Promise.resolve({ value: localStorage.getItem(key) }),
  set: (key, val) => Promise.resolve(localStorage.setItem(key, val))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
