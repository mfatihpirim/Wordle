import { Link } from '@tanstack/react-router'
import { useBoundStore } from '../store/useBoundStore'

export default function Header() {

  const activeSessionId = useBoundStore.use.activeSessionId()
  const sessions = useBoundStore.use.sessions()
  const { clearActiveSession, syncGameState, startNewGame } = useBoundStore.use.actions()

  const handleHomeClick = async () => {
    const currentSession = sessions.find(s => s.id === activeSessionId)
    if (currentSession?.status !== 'playing') {
      clearActiveSession()
      await syncGameState()
    }
  }

  const handleShuffleClick = async () => {
    clearActiveSession()
    await startNewGame(false)
  }

  const tempShuffleButtonStyle = {
    marginLeft: '10px',
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#f9f9f9',
    cursor: 'pointer'
  }

  return (
    <nav className="p-2 flex gap-2 border-b">
      <Link to="/" onClick={handleHomeClick} >
        Wordle
      </Link>
      <button style={tempShuffleButtonStyle} onClick={handleShuffleClick}>Shuffle</button>
    </nav>
  )
}