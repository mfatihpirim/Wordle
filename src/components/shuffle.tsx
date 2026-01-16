import { useState, useImperativeHandle, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useBoundStore } from '../store/useBoundStore'

interface ShuffleProps {
  className?: string
  children: React.ReactNode // This is your DiceFill icon
}

// We refactored the Shuffle component using forwardRef and useImperativeHandle to
// "expose" its internal animation and game logic to its parent. This allows the Sidebar
// button to trigger the dice spin and a new game when clicking either the icon or the text,
// while keeping the specific animation code isolated and "bug-free."
const Shuffle = forwardRef(({ className, children }: ShuffleProps, ref) => {
  const { clearActiveSession, startNewGame } = useBoundStore.use.actions()
  const [rolling, setRolling] = useState(false)

  // We expose this so the parent can trigger it,
  // but we also keep it here for the Header usage.
  const handleRoll = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (rolling) return

    setRolling(true)

    // Game Logic
    clearActiveSession()
    await startNewGame(false)

    // Match this duration to the animation (0.6s)
    setTimeout(() => setRolling(false), 600)
  }

  // Expose the handleRoll function to the parent
  useImperativeHandle(ref, () => ({
    handleRoll,
  }))

  return (
    <motion.div
      onClick={(e) => {
        e.stopPropagation()
        handleRoll()
      }}
      // --- HOVER ANIMATION (The "Little Tilt") ---
      whileHover={
        !rolling
          ? {
              rotate: -15,
              x: -2,
              transition: { type: 'spring', stiffness: 300 },
            }
          : {}
      }
      // --- CLICK ANIMATION (The "Big Roll") ---
      animate={rolling ? { rotate: 720, scale: [1, 1.3, 1] } : { rotate: 0 }}
      transition={{ duration: 0.6 }}
      className={cn(
        'flex items-center justify-center cursor-pointer shrink-0',
        className
      )}
    >
      {children}
    </motion.div>
  )
})

Shuffle.displayName = 'Shuffle' // for debugging since the component technically becomes anonymous
export default Shuffle
