import { useBoundStore } from '../store/useBoundStore'
import { useShallow } from 'zustand/react/shallow'
import { Progress } from './ui/progress'

// Config
const BASE_THRESHOLDS = [0, 1, 2, 3, 5, 8, 13, 21, 34]
const LEVEL_UP_MODIFIER = 2

const Title = {
  1: 'SCRIBE', // 0 - 1 wins  (Threshold: 0)
  2: 'TYPOGRAPHER', // 2 - 3 wins  (Threshold: 2)
  3: 'SCRABBLER', // 4 - 5 wins  (Threshold: 4)
  4: 'WORDSMITH', // 6 - 9 wins  (Threshold: 6)
  5: 'SPELLCASTER', // 10 - 15 wins (Threshold: 10)
  6: 'SYLLABOSS', // 16 - 25 wins (Threshold: 16)
  7: 'WORDLORD', // 26 - 41 wins (Threshold: 26)
  8: 'ARCHWRITER', // 42 - 67 wins (Threshold: 42)
  9: 'LEXIKING', // 68+ wins     (Threshold: 68)
} as const
// 'as const' is required to make the values literal strings
// The value of key 4 is specifically the string 'WORDSMITH', not just any random string.

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

// "SCRIBE" | "TYPOGRAPHER" | "SCRABBLER" | ... | "LEXIKING"
type TitleValue = (typeof Title)[Level]

interface Rank {
  level: Level
  title: TitleValue
  progress: number
}

export default function PlayerRank() {
  // https://docs.google.com/document/d/1jkRWqD8-iAcn6VJm9ZntB7kPbNUNeQrTf5kVOSzpCS0/edit?usp=sharing
  const rank = useBoundStore(
    // Without useShallow the selector is creating a new object reference every single time it runs
    useShallow((state) => {
      const wins = state.sessions.filter((s) => s.status === 'won').length
      // recalculates even if wins doesn't change BUT at least a re-render only happens if rank changes
      return getRank(wins, LEVEL_UP_MODIFIER)
    })
  )

  return (
    <div>
      <h1 className="font-nytkarnak text-base md:text-2xl flex gap-[0.25em] leading-figma">
        <span className="text-foreground/75">Lv. {rank.level}</span>
        <span className="text-foreground">{rank.title}</span>
      </h1>
      <Progress
        key={rank.level}
        className="mt-2 md:mt-[8.5px]"
        value={rank.progress}
      />
    </div>
  )
}

const getThresholds = (modifier: number) =>
  BASE_THRESHOLDS.map((n) => Math.floor(n * modifier))

const findLevelIndex = (wins: number, thresholds: number[]) => {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (wins >= thresholds[i]) return i
  }
  return 0
}

const getRank = (wins: number, modifier: number = 1): Rank => {
  const thresholds = getThresholds(modifier)
  const levelIdx = findLevelIndex(wins, thresholds)

  const currentThreshold = thresholds[levelIdx]
  const nextThreshold = thresholds[levelIdx + 1] // undefined if at max level

  const isMaxLevel = nextThreshold === undefined

  const progress = isMaxLevel
    ? 100 // max level
    : ((wins - currentThreshold) / (nextThreshold - currentThreshold)) * 100

  // pushes level to 1 if 0, 9 if more than 9
  const levelClamped = Math.min(Math.max(levelIdx + 1, 1), 9)

  return {
    level: levelClamped as Level,
    title: Title[levelClamped as Level],
    progress: progress,
  }
}
