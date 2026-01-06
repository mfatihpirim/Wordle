import {type StateCreator} from 'zustand'
import { validateGuess } from '../wordManager'
import { type Draft } from 'immer'
import { type BoundState } from './useBoundStore'

export interface TileData {
    letter: string
    status: 'empty' | 'absent' | 'present' | 'correct'
}

export interface GameState {

    // STATE (Live Game Data)  
    wordLength: number
    board: TileData[][]
    currentRow: number
    status: 'playing' | 'won' | 'lost' | 'loading' | 'uninitialized' | 'error' | 'submitting'
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

export const createEmptyBoard = (rows = 6, cols = 5): TileData[][] => {
    return Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            letter: '',
            // TypeScript now knows this 'empty' is the literal type 'empty'
            status: 'empty' as const 
        }))
    )
}

export const createGameSlice: StateCreator<
    BoundState,
    [["zustand/immer", never]],
    [],
    GameState
    > = (set, get) => ({
        wordLength: 5,
        board: [],
        currentRow: 0,
        status: 'playing',
        guesses: [],
        unsubmittedGuess: '',
        secretWord: 'DREAM',

        actions: {
            addLetter: (key) => addLetter(set, get, key),
            removeLetter: () => removeLetter(set, get),
            submitGuess: () => submitGuess(set, get)
        }
})

const addLetter = (set: GameSet, get: GameGet, key: string) => {

    // Get the current state values (destructure for easier access)
    const { currentRow,  wordLength, unsubmittedGuess, status } = get()

    // 1. Guard Clauses
    if (status !== 'playing' || unsubmittedGuess.length >= wordLength) return

    // 2. Process Letter Addition
    set((state) => {

        const currentTile = state.unsubmittedGuess.length 

        state.board[currentRow][currentTile].letter = key

        state.unsubmittedGuess += key
    })
}

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

const submitGuess = async (set: GameSet, get: GameGet) => {

    const { status, unsubmittedGuess, wordLength } = get()

    // 1. Guard Clauses
    if (status !== 'playing' || unsubmittedGuess.length < wordLength) return

    // 2. Async Validation
    set((state) => { state.status = 'submitting' })
    const isValid = await validateGuess(unsubmittedGuess) 
    if (!isValid) {
        set((state) => { state.status = 'playing' })
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
            status: state.status as 'playing' | 'won' | 'lost'
        })
    }
}

const getTileStatuses = (guess: string, secretWord: string): TileData['status'][] => {
    
    guess = guess
    secretWord = secretWord

    const statuses: TileData['status'][] = new Array(secretWord.length).fill('absent')

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
    empty: 0 
}
// Runs every time the store changes, but it only updates the UI (triggers a re-render) when a row is actually submitted
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