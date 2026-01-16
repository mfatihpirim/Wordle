import { Link } from '@tanstack/react-router'
import { useBoundStore } from '../store/useBoundStore'
import PlayerRank from './player-rank'
import Shuffle from './shuffle'
import { CircleQuestionMark } from 'lucide-react'
import WordleIconLight from '../assets/wordle_icon_filled.svg?react'
import Sidebar from '../components/sidebar'
import DiceFill from '../assets/dice-fill.svg?react'

export default function Header() {
  const activeSessionId = useBoundStore.use.activeSessionId()
  const sessions = useBoundStore.use.sessions()
  const { clearActiveSession, syncGameState } = useBoundStore.use.actions()

  const handleHomeClick = async () => {
    const currentSession = sessions.find((s) => s.id === activeSessionId)
    if (currentSession?.status !== 'playing') {
      clearActiveSession()
      await syncGameState()
    }
  }

  return (
    <nav className="h-20 md:h-22 p-6 md:py-8 border-b border-border flex items-center justify-between ">
      {/* Left Side */}
      <Link to="/" onClick={handleHomeClick} className="block">
        <div className="flex items-center gap-4">
          <WordleIconLight className="size-8 md:size-10" />
          <h1 className="text-2xl md:text-[32px] md:text- font-nytkarnak font-bold text-foreground text-center transition-all">
            Wordle
          </h1>
        </div>
      </Link>

      {/* Right Side */}
      <div className="flex gap-6 md:gap-8 items-center">
        <Shuffle className="size-8 md:size-10 text-foreground/90">
          <DiceFill className="size-full" />
        </Shuffle>
        <CircleQuestionMark className="md:hidden size-8 md:size-10 text-foreground/90 transition-all cursor-pointer hover:opacity-80" />

        <div className="hidden md:block">
          <PlayerRank></PlayerRank>
        </div>

        <Sidebar />
      </div>
    </nav>
  )
}
