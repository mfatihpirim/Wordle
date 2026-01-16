import { useEffect } from 'react'
import { useBoundStore } from '../store/useBoundStore'
import { getKeyboardStatusMap } from '../store/gameSlice'
import { cn } from '@/lib/utils'
import { Delete } from 'lucide-react'
import { motion } from 'framer-motion'

const KEYS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
]

export default function Keyboard() {
  // STATE DATA IN STORE
  const status = useBoundStore.use.status()

  // KEYBOARD ACTIONS
  // Select only the actions we need
  // Using separate selectors to avoid unnecessary re-renders
  const { addLetter, removeLetter, submitGuess } = useBoundStore.use.actions()

  // Unified handler for physical and virtual input
  const handleInput = (key: string) => {
    if (status !== 'playing') return

    if (key === 'Enter') submitGuess()
    else if (key === 'Backspace') removeLetter()
    else if (/^[A-Z]$/.test(key)) addLetter(key)
  }

  // Effect to handle physical keyboard input

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase()
      if (key === 'ENTER') handleInput('Enter')
      else if (key === 'BACKSPACE') handleInput('Backspace')
      else if (/^[A-Z]$/.test(key)) handleInput(key)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
    // Added status and action functions to dependencies to avoid stale closures
    // Especially for status
    // The physical keyboard listener needs the latest status value
  }, [addLetter, removeLetter, submitGuess, status])

  return (
    <div className="mx-auto mt-2 w-full max-w-118">
      {KEYS.map((row, i) => (
        <div
          key={i}
          className="mb-1 md:mb-2 flex justify-center gap-1 md:gap-2 touch-none"
        >
          {row.map((keyLabel) => (
            <Key
              key={keyLabel}
              keyLabel={keyLabel}
              onClick={() => handleInput(keyLabel)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const STATUS_CLASSES: Record<string, string> = {
  correct: 'bg-correct text-primary-foreground',
  present: 'bg-present text-primary-foreground',
  absent: 'bg-absent text-primary-foreground',
  empty: 'bg-key text-foreground', // Unused keys
}

// Right now each key (unlike the tiles) subscribes to the store individually
// and must derive its own status based on the submitted guesses.
// The reduce logic runs everytime the board
const Key = ({
  keyLabel,
  onClick,
}: {
  keyLabel: string
  onClick: (k: string) => void
}) => {
  const status = useBoundStore((state) => {
    const map = getKeyboardStatusMap(state)
    return map[keyLabel] || 'empty'
  })

  const isLarge = keyLabel === 'Enter' || keyLabel === 'Backspace'
  const KEYBOARD_UPDATE_DELAY = 1400

  return (
    <motion.button
      // 1. Framer handles the physical 'squish'
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      onClick={() => onClick(keyLabel)}
      className={cn(
        'flex h-14 items-center justify-center rounded font-bold uppercase select-none cursor-pointer transition-colors duration-1000 px-3 hover:brightness-90',
        // 2. Add 'active:brightness-75' here for the darkening effect on click
        'active:brightness-75',
        isLarge ? 'w-12 md:w-16 text-xs' : 'w-8 md:w-10 text-xl',
        STATUS_CLASSES[status]
      )}
      style={{
        transitionDelay:
          status !== 'empty' ? `${KEYBOARD_UPDATE_DELAY}ms` : '0ms',
      }}
    >
      {keyLabel === 'Backspace' ? (
        <Delete className="text-foreground/90 size-6"></Delete>
      ) : (
        keyLabel
      )}
    </motion.button>
  )
}
