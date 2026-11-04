import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RoomSharePage } from '@/components/RoomSharePage'
import { shareIdFromLocation } from '@/lib/room-share'

function Root() {
  const [shareId, setShareId] = useState(shareIdFromLocation)
  useEffect(() => {
    const sync = () => setShareId(shareIdFromLocation())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  if (shareId) return <RoomSharePage id={shareId} />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
