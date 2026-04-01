import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing.jsx'
import App from './App.jsx'
import Train from './pages/Train.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/classify" element={<App />} />
        <Route path="/train" element={<Train />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
