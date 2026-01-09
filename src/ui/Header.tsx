import { Link } from '@tanstack/react-router'
import { useBoundStore } from '../store/useBoundStore'

export default function Header() {

  const activeSessionId = useBoundStore.use.activeSessionId()
  const sessions = useBoundStore.use.sessions()
  const { clearActiveSession, syncGameState } = useBoundStore.use.actions()

  const handleHomeClick = async () => {
    const currentSession = sessions.find(s => s.id === activeSessionId)
    if (currentSession?.status !== 'playing') {
      clearActiveSession()
      await syncGameState()
    }
  }

  return (
    <nav className="p-2 flex gap-2 border-b">
      <Link to="/" onClick={handleHomeClick} className="[&.active]:font-bold">
        Home
      </Link>
    </nav>
  )
}