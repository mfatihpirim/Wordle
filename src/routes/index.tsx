import { createFileRoute, Link } from '@tanstack/react-router'
import { useBoundStore } from '../store/useBoundStore'
import { Button } from '@/components/ui/button'
import WordleIcon from '../assets/wordle_icon.svg?react'
import WordleIconLight from '../assets/wordle_icon_filled.svg?react'
import WordleIconDark from '../assets/wordle_icon_dark.svg?react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const activeSessionId = useBoundStore.use.activeSessionId()
  const hasInitialized = useBoundStore.use.hasInitialized()
  const sessions = useBoundStore.use.sessions()
  const currentSession = sessions.find((s) => s.id === activeSessionId)
  const currentRow = useBoundStore.use.currentRow()

  // A game is NEW if the very first tile of the first row is still empty
  // If row 0, tile 0 has no letter, no one has even typed a character yet.
  const isNewGame = !currentSession || currentSession.board[0][0].letter === ''

  // Initialization occurs in the background as the persisted storage loads
  if (!hasInitialized) {
    return <div className="flex justify-center p-10">Loading Wordle...</div>
  }

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedLength = sessions.length.toString().padStart(4, '0')

  // px-[clamp(68px,42vw-97px,628px)]
  return (
    <div className="flex flex-col items-center px-17 py-32 min-h-screen w-full bg-home transition-colors duration-500 justify-center">
      {/* ICON */}
      <div className="flex justify-center-safe">
        <WordleIconLight className="dark:hidden size-16 md:size-20" />
        <WordleIconDark className="hidden dark:block size-16 md:size-20" />
      </div>

      {/* TITLE */}
      <h1 className="text-5xl font-nytkarnak font-bold text-foreground text-center mt-4">
        Wordle
      </h1>

      {/* PROMPT & ACTION BUTTONS  */}
      {isNewGame ? (
        <>
          <p className="text-2xl md:text-[40px] font-msft text-center mt-2 md:mt-4">
            Get 6 chances to guess <br /> a 5-letter word
          </p>
          {/* BUTTONS */}
          <div className="inline-flex flex-col items-center md:flex-row md:justify-center gap-x-2 mt-12 gap-y-2">
            <Link to="/game" className="btn-primary md:order-3">
              <Button>Play</Button>
            </Link>
            <Button disabled variant="outline" className="md:order-1">
              Subscribe{' '}
            </Button>
            <Button disabled variant="outline" className="md:order-2">
              Log in
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-2xl md:text-[40px] font-msft text-center mt-2 md:mt-4">
            {`You've made ${currentRow} of 6`}
            <br />
            guesses. Keep it up!
          </p>
          <div className="inline-flex flex-col items-center md:flex-row md:justify-center gap-x-2 mt-12 gap-y-2">
            <Link to="/game" className="btn-primary">
              <Button>Continue</Button>
            </Link>
          </div>
        </>
      )}

      {/* META TEXT */}
      <div className="text-center text-foreground mt-32 md:mt-14">
        <p className="font-msft">{formattedDate}</p>
        <p className="font-sans">No. {formattedLength}</p>
        <p className="font-sans">Edited by Fatih Pirim</p>
      </div>
    </div>
  )
}
