import { createFileRoute, Link } from '@tanstack/react-router'
import { useBoundStore } from '../store/useBoundStore';

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {

  const activeSessionId = useBoundStore.use.activeSessionId()
  const hasInitialized = useBoundStore.use.hasInitialized()
  const sessions = useBoundStore.use.sessions()
  const currentSession = sessions.find(s => s.id === activeSessionId)

  // A game is NEW if the very first tile of the first row is still empty
  // If row 0, tile 0 has no letter, no one has even typed a character yet.
  const isNewGame = !currentSession || currentSession.board[0][0].letter === ''

  // 3 renders happen here, as you may see in console.log
  // Render 1: App is empty.
  // Render 2: App is busy fetching your word.
  // Render 3: App is ready to play.
  // https://docs.google.com/document/d/1Y5f--TW27_lHoSi7hJqrwnV4wI1n8G2wjErmVbruGSc/edit?usp=sharing
  // console.log("Home Render - hasInitialized:", hasInitialized)
  
  // Initialization occurs in the background as the persisted storage loads
  if (!hasInitialized) {
    return <div className="flex justify-center p-10">Loading Wordle...</div>
  }

  return (
    <div className="home-screen">
      <h1>Wordle</h1>
      
      {/* If activeSessionId is set, it's a resume. If null, it's a fresh play. */}
      <Link to="/game" className="btn-primary">
        {isNewGame ? 'Play Game' : 'Resume Game'}
      </Link>
    </div>
  )
}