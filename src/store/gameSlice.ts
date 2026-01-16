import { type StateCreator } from 'zustand'
import { validateGuess } from '../data/wordManager'
import { type Draft } from 'immer'
import { type BoundState } from './useBoundStore'

export interface TileData {
  letter: string
  status: 'empty' | 'typing' | 'absent' | 'present' | 'correct'
}

export interface GameState {
  // STATE (Live Game Data)
  board: TileData[][]
  currentRow: number
  status:
    | 'playing'
    | 'won'
    | 'lost'
    | 'loading'
    | 'uninitialized'
    | 'error'
    | 'submitting'
  guesses: string[]
  unsubmittedGuess: string // the guess being typed right now
  secretWord: string

  // ACTIONS (Logic updating the state)

  actions: {
    addLetter: (key: string) => void
    removeLetter: () => void
    submitGuess: () => void
  }
}

// These types allow our handlers to be fully type-safe
export type GameSet = (fn: (state: Draft<BoundState>) => void) => void
export type GameGet = () => BoundState

export const createEmptyBoard = (): TileData[][] => {
  // Create a single row of 5 empty tiles
  const createRow = () =>
    Array.from({ length: 5 }, () => ({
      letter: '',
      status: 'empty' as const,
    }))

  // Generate 5 unique rows
  return Array.from({ length: 5 }, createRow)
}

/**
 * Game slice factory for the zustand store.
 *
 * @remarks
 * - Initializes game-related state (board, cursor, status, secret word, etc.).
 * - Binds action handlers (addLetter, removeLetter, submitGuess) to the slice so
 *   UI code can call state.actions.* without knowing implementation details.
 * - Uses the immer middleware signature (Draft<BoundState>) to allow safe mutable
 *   updates inside action handlers.
 *
 * Example usage:
 * const slice = createGameSlice(set, get)
 *
 * @returns A configured GameState slice to merge into the global store.
 */
export const createGameSlice: StateCreator<
  BoundState,
  [['zustand/immer', never]],
  [],
  GameState
> = (set, get) => ({
  board: [],
  currentRow: 0,
  status: 'playing',
  guesses: [],
  unsubmittedGuess: '',
  secretWord: 'DREAM',

  actions: {
    addLetter: (key) => addLetter(set, get, key),
    removeLetter: () => removeLetter(set, get),
    submitGuess: () => submitGuess(set, get),
  },
})

/**
 * Handle adding a letter to the current unsubmitted guess.
 *
 * @remarks
 * Guards against non-playing states and overfilling the row. Updates the
 * board tile at the current cursor and appends the letter to unsubmittedGuess.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 * @param key - The letter to insert.
 */
const addLetter = (set: GameSet, get: GameGet, key: string) => {
  // Get the current state values (destructure for easier access)
  const { currentRow, unsubmittedGuess, status } = get()

  // 1. Guard Clauses
  if (status !== 'playing' || unsubmittedGuess.length >= 5) return

  // 2. Process Letter Addition
  set((state) => {
    const currentTile = state.unsubmittedGuess.length

    state.board[currentRow][currentTile].letter = key

    state.unsubmittedGuess += key
  })
}

/**
 * Handle removing the last letter from the current unsubmitted guess.
 *
 * @remarks
 * Guards against non-playing states and when there is no letters to remove.
 * Clears the last tile on the board row and shortens the unsubmittedGuess string.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 */
const removeLetter = (set: GameSet, get: GameGet) => {
  const { unsubmittedGuess, status } = get()

  // 1. Guard Clauses
  if (status !== 'playing' || unsubmittedGuess.length <= 0) return

  // 2. Process Letter Removal
  set((state) => {
    // The index to clear is simply the current length minus one
    const lastLetterIndex = state.unsubmittedGuess.length - 1

    // Clear the contents of the tile at the index
    state.board[state.currentRow][lastLetterIndex].letter = ''

    // Update the string
    state.unsubmittedGuess = state.unsubmittedGuess.slice(0, -1)
  })
}

/**
 * Submit the current unsubmitted guess and advance the game state.
 *
 * @remarks
 * Lifecycle and side-effects:
 * 1. Guard — returns early unless in 'playing' and the guess length equals 5.
 * 2. UI state — sets status = 'submitting' to signal validation in progress.
 * 3. Validation — awaits validateGuess(guess). If invalid, reverts status and aborts.
 * 4. Apply changes — on success, applyGuessToBoard writes tile colors and records the guess.
 * 5. Outcome — determineGameOutcome updates status/currentRow and clears unsubmittedGuess.
 * 6. Session sync — after sync, if an activeSessionId exists, pushes the new board/status
 *    into persistent session history via actions.updateSession.
 *
 * Important:
 * - Validation runs before any board mutation so invalid words do not flip tiles.
 * - The function intentionally separates async validation from synchronous mutations so
 *   UI can reflect a submitting state.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 */
const submitGuess = async (set: GameSet, get: GameGet) => {
  const { status, unsubmittedGuess } = get()

  // 1. Guard Clauses
  if (status !== 'playing' || unsubmittedGuess.length < 5) return

  // 2. Async Validation
  set((state) => {
    state.status = 'submitting'
  })
  const isValid = await validateGuess(unsubmittedGuess)
  if (!isValid) {
    set((state) => {
      state.status = 'playing'
    })
    return
  }

  // 3. Process Turn (Evaluate Guess & Advance)
  set((state) => {
    applyGuessToBoard(state)
    determineGameOutcome(state)
  })

  // 4. Session Sync
  const state = get()
  if (state.activeSessionId) {
    // We "Push" the new board and status into the session history
    state.actions.updateSession(state.activeSessionId, {
      board: state.board,
      status: state.status as 'playing' | 'won' | 'lost',
    })
  }
}

/**
 * Compute tile statuses (correct/present/absent) for a guess against the secret.
 *
 * @remarks
 * Performs a two-pass algorithm: first mark 'correct' tiles and decrement a
 * pouch tally for matched letters, then mark 'present' where letters exist in
 * the pouch. Returns a status per position matching the secret's length.
 *
 * @param guess - The player's guess string.
 * @param secretWord - The secret word to compare against.
 * @returns An array of TileData.status values for each letter.
 */
const getTileStatuses = (
  guess: string,
  secretWord: string
): TileData['status'][] => {
  guess = guess
  secretWord = secretWord

  const statuses: TileData['status'][] = new Array(secretWord.length).fill(
    'absent'
  )

  // Tally up the letters (The Pouch)
  // pouch contains the letters, ex: ['D','R','E','A','M']

  const pouch: Record<string, number> = {}
  for (const char of secretWord) {
    pouch[char] = (pouch[char] || 0) + 1
  }

  // Pass 1: Find the Greens (Direct correct matches)
  // We "take the letters out" or "cross them out" from
  // the pouch as we mark the statuses array
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secretWord[i]) {
      statuses[i] = 'correct'
      pouch[guess[i]] -= 1 // Spend one
    }
  }

  for (let i = 0; i < guess.length; i++) {
    // If the letter at this index is not correct
    // and the letter is still in the pouch
    if (statuses[i] !== 'correct' && pouch[guess[i]] > 0) {
      // mark this letter present
      statuses[i] = 'present'
      pouch[guess[i]] -= 1 // Spend one
    }
  }

  // Return the array of statuses for each letter in the guess
  // E.g., ['correct', 'absent', 'present', 'absent', 'correct']
  return statuses
}

// Define "weight" for colors so we can compare them easily.
// Green (correct) is the "strongest" color, followed by Yellow (present).
const RANK: Record<string, number> = {
  correct: 3,
  present: 2,
  absent: 1,
  empty: 0,
}
// Runs every time the store changes, but it only updates the UI (triggers a re-render) when a row is actually submitted
/**
 * Produce a keyboard status map aggregated from submitted rows.
 *
 * @remarks
 * Purpose:
 * - Builds a map letter -> best-seen status used to color the on-screen keyboard.
 *
 * finishedRowsCount behavior:
 * - While playing: only include fully submitted rows (rows BEFORE currentRow).
 *   The row at currentRow is still being edited and must not influence keyboard colors.
 * - After game over (won|lost): include the currentRow as well (finishedRowsCount = currentRow + 1)
 *   because that final submission should be reflected on the keyboard.
 *
 * Precedence & RANK:
 * - When multiple submissions mention the same letter, the RANK table (correct > present > absent > empty)
 *   decides which status wins. A later stronger status upgrades earlier weaker ones.
 *
 * @param state - The current BoundState.
 * @returns A record mapping letter -> status string for keyboard coloring.
 */
export const getKeyboardStatusMap = (state: BoundState) => {
  // This object will store our final result: { 'A': 'correct', 'B': 'absent', ... }
  const statusMap: Record<string, string> = {}

  // 1. Determine which rows the player has actually finished.
  // If the game is won or lost, we should look at the current row too.
  // If they are still playing, we only look at the rows ABOVE the current cursor.
  const isGameOver = state.status === 'won' || state.status === 'lost'
  const finishedRowsCount = isGameOver ? state.currentRow + 1 : state.currentRow

  // 2. Loop through every row that has been submitted.
  for (let i = 0; i < finishedRowsCount; i++) {
    const row = state.board[i]

    // 3. Look at every individual tile in that row.
    row.forEach((tile) => {
      const letter = tile.letter
      const newStatus = tile.status

      // 4. Check if we've seen this letter in an earlier row.
      // If we haven't seen it yet, default it to 'empty'.
      const existingStatus = statusMap[letter] || 'empty'

      // 5. THE LOGIC: Should the keyboard key change color?
      // We only update the keyboard if the NEW status is "better" than the old one.
      // Example: If 'E' was Yellow in Row 1, but is Green in Row 2,
      // the RANK check (3 > 2) ensures the keyboard turns Green.
      if (RANK[newStatus] > RANK[existingStatus]) {
        statusMap[letter] = newStatus
      }
    })
  }

  // Return the map so the Keyboard component can color the keys.
  return statusMap
}

/**
 * Apply the result of the current guess to the board tiles and record the guess.
 *
 * @remarks
 * Uses getTileStatuses to compute per-tile statuses, writes statuses/letters
 * into the current row, and appends the guess to the guesses history.
 *
 * @param state - Immer Draft of the BoundState to mutate.
 */
const applyGuessToBoard = (state: Draft<BoundState>) => {
  const guess = state.unsubmittedGuess
  const secret = state.secretWord

  const statuses = getTileStatuses(guess, secret)

  state.guesses.push(guess)

  // Making these updates changes the color of the tiles
  statuses.forEach((status, i) => {
    state.board[state.currentRow][i].status = status
    state.board[state.currentRow][i].letter = guess[i]
  })
}

/**
 * Determine whether the game has been won, lost, or should continue.
 *
 * @remarks
 * Compares the last submitted guess to the secret word and checks for the
 * final row. Updates state.status accordingly and advances the currentRow
 * when the game continues. Clears unsubmittedGuess after processing.
 *
 * @param state - Immer Draft of the BoundState to mutate.
 */
const determineGameOutcome = (state: Draft<BoundState>) => {
  const lastGuess = state.unsubmittedGuess
  const isWin = lastGuess === state.secretWord
  const isLastRow = state.currentRow === state.board.length - 1

  if (isWin) {
    state.status = 'won'
  } else if (isLastRow) {
    state.status = 'lost'
  } else {
    state.status = 'playing'
    state.currentRow += 1
  }

  state.unsubmittedGuess = ''
}
