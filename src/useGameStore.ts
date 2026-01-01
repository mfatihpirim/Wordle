import {create} from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { isWord, getRandomWord } from './wordService'
 
// ------------------------------------------
// HELPER / UTILITY FUNCTIONS
// ------------------------------------------

const createGameBoard = (wordLength: number): TileData[][] => {
    // Create an array of 6 rows, for each row create an array of {wordLength} tiles
    return Array.from({ length: 6 }, () =>
        Array.from({ length: wordLength }, () => ({
            letter: '',
            status: 'empty' as TileData['status'], // "as" type casting when colon used in object literal
        }))
    )
    // Returns:
    // [
    //   [{letter: '', status: 'empty'}, {letter: '', status: 'empty'}...], // Row 0
    //   [{letter: '', status: 'empty'}, {letter: '', status: 'empty'}...], // Row 1
    //   ...
    // ]
}

// Helper function to determine tile statuses for a given guess
const getTileStatuses = (guess: string, secretWord: string): TileData['status'][] => {
    
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

// ------------------------------------------
// ZUSTAND STORE DEFINITION
// ------------------------------------------

export interface TileData {
    letter: string
    status: 'empty' | 'absent' | 'present' | 'correct'
}

interface GameState {

    // Link to the Session
    // This can only have an active session because game state is a shell
    // The data in GameState is transient and can be re-created from the session
    // The states are transient UI states
    
    activeSessionId: string | null;

    // 2. STATE (Live Game Data)  
    wordLength: number
    board: TileData[][]
    currentRow: number
    currentTile: number
    status: 'playing' | 'won' | 'lost' | 'loading' | 'uninitialized' | 'error' | 'submitting'
    guesses: string[]
    unsubmittedGuess: string // the guess being typed right now
    secretWord: string
 
    // 3. ACTIONS (Logic updating the state)

    loadGame: () => void
    // setWordLength: (length: number) => void
    // shuffleBoard: () => void 

    addLetter: (key: string) => void
    removeLetter: () => void
    submitGuess: () => void
}

// give key status that is assigned at birth
// key subscribes to a selector
// when user clicks enter
// for letters in that specific word
// 

const useGameStoreBase = create<GameState>()(
    immer((set, get) => ({

        activeSessionId: null,

        wordLength: 5,
        board: createGameBoard(5),
        currentRow: 0,
        currentTile: 0,
        status: 'uninitialized',
        guesses: [],
        unsubmittedGuess: '',
        secretWord: 'DREAM',

        /** ACTIONS
         * Colocated Actions: It is recommended to add your store actions directly 
         * to the store alongside the state they update.
         */
        
        loadGame: async () => {
            
            const {wordLength, status} = get()

            if (status === 'loading') return // Stop here if we're already busy!
            set((state) => { state.status = 'loading' })

            try {
                const word = await getRandomWord(get().wordLength)

                // 1. Check if the word exists at all (Network failure check)
                // 2. Length Check
                // Also don't need state.status here because we are just passing a partial object.
                if (!word || word.length !== wordLength) {
                    throw new Error("Invalid word received")
                }

                set((state) => {

                    state.secretWord = word.toUpperCase()
                    console.log(`Secret word is: ${state.secretWord}`)

                    state.board = createGameBoard(word.length) 
                    state.currentRow = 0
                    state.status = 'playing'
                })
                
            } catch (error) {
                set((state) => { state.status = 'error' })
                console.error("Game Load Failed:", error)
            }
            
        },

        addLetter: (key: string) => {

            // Get the current state values (destructure for easier access)
            const { currentRow,  wordLength, unsubmittedGuess, status} = get()

            if (status !== 'playing') return

            // Don't add a letter if the current tile index is already at or beyond the word length
            if (unsubmittedGuess.length >= wordLength) return

            set((state) => {

                const currentTile = state.unsubmittedGuess.length 

                state.board[currentRow][currentTile].letter = key

                state.unsubmittedGuess += key
            })
        },

        removeLetter: () => {

            const { unsubmittedGuess, status } = get()

            if (status !== 'playing') return

            // Don't remove a letter if we are already at the beginning of the row
            if (unsubmittedGuess.length <= 0) return

            set((state) => {
                const currentTile = state.unsubmittedGuess.length
                // Since currentTile points to the next empty tile, we need to go back one to clear the last filled tile
                const targetTile = currentTile - 1
                // Clear the letter at the target tile
                state.board[state.currentRow][targetTile].letter = ''

                state.unsubmittedGuess = state.unsubmittedGuess.slice(0, -1)
            })
        },

        submitGuess: async () => {

            if (get().status !== 'playing') return

            const { currentRow, wordLength, board, unsubmittedGuess, secretWord } = get()

            // Ensure the current row is fully filled before submitting
            // Do this by check if the unsubmitted guess length matches the word length
            if (unsubmittedGuess.length < wordLength) return
            
            // LOCK the player from other actions while we validate the word
            set({ status: 'submitting' })
            // Check if the guessed word is a valid word using the dictionary API
            const isValidWord: boolean = await isWord(unsubmittedGuess)
            if (!isValidWord) {
                console.log(`"${unsubmittedGuess}" is not a valid word.`)
                set({ status: 'playing' })
                return
            }

            // Efficiency (Batching): Zustand and React work together to "re-render" the UI. 
            // If you call set() multiple times, you risk triggering multiple re-renders. 
            // One set() ensures the UI only updates once per guess.
            set((state) => {

                const statuses = getTileStatuses(state.unsubmittedGuess, state.secretWord)

                // Update the tile statuses on the board row
                statuses.forEach((status, i) => {
                    state.board[state.currentRow][i].status = status
                })

                // Add to the list of submitted guesses (guesses)
                // This promotes it from a draft to history
                // THE GUESS IS SUBMITTED
                const submittedGuess = unsubmittedGuess // Capture the guess at submission time
                state.guesses.push(submittedGuess)



                if (submittedGuess === secretWord) { 
                    console.log("The game is won!")
                    state.status = 'won'
                    state.unsubmittedGuess = ''
                    // The player wins, no further updates to board
                    return
                }

                // 1. If the game status is playing
                // 2. If the current row is fully filled
                // 3. If the guessed word is valid word checked by the API
                // 4. We have updated the guesses history
                // 5. If the guessed word DOES NOT match the target word
                
                // ==> We try to shift the row down

                // If the current row is NOT the last row
                if (currentRow < board.length - 1) {
                    state.currentRow += 1
                    state.status = 'playing'
                // If the current row is the last row
                } else {
                    console.log('Game over. No more rows left')
                    state.status = 'lost'
                }   
                
                state.unsubmittedGuess = ''
            })
        }

})))

/**
 * Generates auto-selectors for the store to improve readability and reduce boilerplate.
 * This allows accessing state via `store.use.key()` instead of writing manual 
 * selector functions like `useStore((state) => state.key)` everywhere.
 * https://zustand.docs.pmnd.rs/guides/auto-generating-selectors#create-the-following-function:-createselectors 
 */

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S,
) => {
  const store = _store as WithSelectors<typeof _store>
  store.use = {}
  for (const k of Object.keys(store.getState())) {
    ;(store.use as any)[k] = () => store((s) => s[k as keyof typeof s])
  }

  return store
}

export const useGameStore = createSelectors(useGameStoreBase)



