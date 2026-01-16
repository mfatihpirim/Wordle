import React from 'react'
import { useBoundStore } from '../store/useBoundStore'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

/**
 * Q: Why are we use atomic subscriptions for each Tile AND memoizing the Row and Grid components?
 * A: https://docs.google.com/document/d/1onzRIhRcf7CKvWGrOVloScZ38eEFEieaWlV-BFSTvoU/edit?usp=sharing
 *
 * Q: Why not just have the Grid subscribe to the whole board and pass down props?
 * A: It would cause all tiles to re-render on any state change, leading to performance issues.
 *
 * Q: ~
 * A: ~
 */

// Grid component: the main entry point for the game board
// ------------------------------------------------------------------------
export default function Grid() {
  const board = useBoundStore((state) => state.board)

  // GUARD: If the board hasn't been synced/created yet, return null
  if (!board || board.length === 0) {
    return (
      <div className="grid-loading">
        Grid.tsx: !board OR board.length === 0.
      </div>
    )
  }

  // We ask the store for the height of the board only to force re-render when the board changes
  const rowCount = board.length

  return (
    <div className="grid grid-rows-6 gap-1 p-2.5 w-max mx-auto">
      {/* We create an array of "Empty" slots just to map over them */}
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <Row key={rowIndex} rowIndex={rowIndex} />
      ))}
    </div>
  )
}
// Row component: the structure for each row of tiles
// ------------------------------------------------------------------------

// React.memo is a higher-order component that memoizes the result.
const Row = React.memo(function Row({ rowIndex }: { rowIndex: number }) {
  const wordLength = 5

  // Create a simple array of indexes: [0, 1, 2, 3, 4]
  const tileIndices = Array.from({ length: wordLength }, (_, i) => i)

  return (
    <div className="grid grid-cols-5 gap-1 w-max">
      {tileIndices.map((tileIndex) => (
        <Tile key={tileIndex} rowIndex={rowIndex} tileIndex={tileIndex} />
      ))}
    </div>
  )
})

// Tile component: atomic subscriber to its own state
// ------------------------------------------------------------------------

const STATUS_CLASSES: Record<string, string> = {
  correct: 'bg-correct border-correct text-primary-foreground',
  present: 'bg-present border-present text-primary-foreground',
  absent: 'bg-absent border-absent text-primary-foreground',
  typing: 'bg-empty border-absent text-foreground',
  empty: 'bg-empty border-border text-foreground',
}

const FLIP_DURATION = 0.6 // sets how long the flip takes
const STAGGER_DELAY = 0.2 // controls the "ripple" timing between tiles

const Tile = ({
  rowIndex,
  tileIndex,
}: {
  rowIndex: number
  tileIndex: number
}) => {
  const { letter, status } = useBoundStore(
    (state) => state.board[rowIndex][tileIndex]
  )

  const isRevealed = ['correct', 'present', 'absent'].includes(status)
  // Calculates the exact millisecond the tile becomes "flat" during its flip so the color change can be timed perfectly.
  const revealDelay = (tileIndex * STAGGER_DELAY + FLIP_DURATION / 2) * 1000

  return (
    <motion.div
      key={`${rowIndex}-${tileIndex}-${letter}`}
      variants={{
        pop: { scale: [1, 1.1, 1] },
        flip: { scaleY: [1, 0, 1] },
      }}
      animate={isRevealed ? 'flip' : letter ? 'pop' : ''}
      transition={{
        duration: isRevealed ? FLIP_DURATION : 0.1,
        delay: isRevealed ? tileIndex * STAGGER_DELAY : 0,
        times: [0, 0.5, 1],
        ease: 'easeInOut',
      }}
      style={{
        transitionProperty: 'background-color, border-color, color',
        transitionDelay: isRevealed ? `${revealDelay}ms` : '0ms',
        transitionDuration: '0ms',
      }}
      className={cn(
        'flex size-16 items-center justify-center border-2 text-[32px] font-bold uppercase select-none',
        STATUS_CLASSES[status],
        isRevealed && 'border-transparent'
      )}
    >
      {letter}
    </motion.div>
  )
}
