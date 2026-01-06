import { type TileData } from './gameSlice'
import dayjs from 'dayjs'
import { refillQueue, getNextGameWord } from '../wordManager'
import {type StateCreator} from 'zustand'
import { type Draft } from 'immer'
import { type BoundState } from './useBoundStore'

export interface GameSession {

    // Identity
    id: string

    // The Snapshot
    secretWord: string
    wordLength: number
    board: TileData[][]
    /**
     * Statuses like 'submitting', 'loading', and 'uninitialized' are transient UI states. 
     * They describe what the application is doing right now (e.g., waiting for an API 
     * response). If you save 'submitting' to the cache and the user refreshes, the game 
     * would wake up "frozen" in a state that can never finish.
     *  */ 
    status: 'playing' | 'won' | 'lost'
    isFeatured: boolean

    // Orchestration Meta Data
    createdAt: number
    lastUpdated: number
}

export interface SessionState {

    sessions: GameSession[] 
    activeSessionId: string | null 
    preferredWordLength: number
    hasInitialized: boolean
    isGeneratingGame: boolean

    actions: {

        initialize: () => void // Runs on app boot. Decides on which game session to provide.
        hydrateGame: (session: GameSession) => void
        startNewGame: (isFeatured: boolean) => void
        resumeGame: (id: string) => void
        updateSession: (id: string, updates: any) => void
        clearActiveSession: () => void 
    }
}

// These types allow our handlers to be fully type-safe
export type SessionSet = (fn: (state: Draft<BoundState>) => void) => void
export type SessionGet = () => BoundState

export const createSessionSlice: StateCreator<
    BoundState,
    [["zustand/immer", never], ["zustand/persist", unknown]],
    [],
    SessionState
> = (set, get) => ({
    sessions: [],
    hasInitialized: false,
    activeSessionId: null,
    preferredWordLength: 5,
    isGeneratingGame: false,

    actions: {
        initialize: () => initialize(set, get),
        hydrateGame: (session) => hydrateGame(set, session),
        startNewGame: (isFeatured) => startNewGame(set, get, isFeatured),
        resumeGame: (id) => resumeGame(set, get, id),
        updateSession: (id, updates) => updateSession(set, id, updates),
        clearActiveSession: () => clearActiveSession(set)
    }
})

// Example:
// If lastUpdated was 11:59 PM yesterday and it is now 12:01 AM today:
// hasNewDayArrived(1767243540000) -> true
const newDayArrivedSince = (timestamp: number) => {
  const now = dayjs()
  const last = dayjs(timestamp)

  // Is "now" after "last", comparing only the calendar day?
  return now.isAfter(last, 'day')
}

const createGameBoard = (wordLength: number): TileData[][] => {
    // Create an array of 6 rows, for each row create an array of {wordLength} tiles
    return Array.from({ length: 6 }, () =>
        Array.from({ length: wordLength }, () => ({
            letter: '',
            status: 'empty' as TileData['status'], // "as" type casting when colon used in object literal
        }))
    )
}

const initialize = (set: SessionSet, get: SessionGet) => {

    // 1. Guard Clause
    if (get().hasInitialized) return

    // 2. Background Tasks (Pre-load words to be used in games)
    // [4, 5, 6, 7].forEach(len => refillQueue(len))

    const latestSession = get().sessions[0]

    set((state) => {
        // Assume no active game by default
        state.activeSessionId = null

        if (latestSession) {
            const isFresh = !newDayArrivedSince(latestSession.lastUpdated)
            const isUnfinished = latestSession.status === 'playing'

            if (isFresh && isUnfinished) {
                state.activeSessionId = latestSession.id
                // Use our new bridge function to setup the engine!
                applyHydration(state, latestSession)
            }
        }

        state.hasInitialized = true
    })
}

const applyHydration = (state: Draft<BoundState>, session: GameSession) => {
    state.secretWord = session.secretWord.toUpperCase()
    state.wordLength = session.wordLength
    state.status = session.status
    
    // Ensure board structure
    state.board = (session.board && session.board.length > 0) 
        ? session.board 
        : createGameBoard(session.wordLength)

    const submittedRows = state.board.filter(row => row[0].status !== 'empty').length
    state.currentRow = submittedRows
    state.guesses = state.board
        .filter((row) => row[0].status !== 'empty')
        .map((row) => row.map((tile) => tile.letter).join(''))
    
    state.unsubmittedGuess = '' 
}

// 2. Update the Action to use the helper
const hydrateGame = (set: SessionSet, session: GameSession) => {
    set((state) => applyHydration(state, session))
}

const startNewGame = async (set: SessionSet, get: SessionGet, isFeatured: boolean) => {

    
    if (get().isGeneratingGame) return

    // 🔒 The Lock: Set this BEFORE the 'await'
    set((state) => { state.isGeneratingGame = true })

    try {
        const wordLength = get().preferredWordLength

        const secretWord = await getNextGameWord(wordLength)

        const newGameSession = {
            id: crypto.randomUUID(),
            secretWord: secretWord,
            wordLength: wordLength,
            board: createGameBoard(wordLength),
            status: 'playing' as GameSession['status'],
            isFeatured: isFeatured,
            createdAt: Date.now(),
            lastUpdated: Date.now()
        }
        
        set((state) => {
            state.sessions.unshift(newGameSession)
            state.activeSessionId = newGameSession.id

            applyHydration(state, newGameSession)
        })

    } finally {
        // 🔓 Unlock: Always unlock, even if the fetch fails
        set((state) => { state.isGeneratingGame = false })
    }

    // ---



}

const resumeGame = (set: SessionSet, get: SessionGet, id: string) => {

    const session = get().sessions.find(s => s.id === id)

    if (!session) {
        console.error(`Resume game error: No game session found with ID: ${id}`)
        return
    }

    set((state) => {
        state.activeSessionId = id

        applyHydration(state, session)
    })
}

const updateSession = (set: SessionSet, id: string, updates: Partial<GameSession>) => {

    set((state) => {

        // We wind the direct index to mutate since we are using Immer
        const index = state.sessions.findIndex(s => s.id === id)

        if (index === -1) return

        // 1. look at the source object
        // 2. it overwrites every value in source with matching key in target object
        Object.assign(state.sessions[index], {
            ...updates,
            lastUpdated: Date.now()
        })

        // If the session is not at the front, move it to the front
        if (index > 0) {
            // removes the element at the index and returns it in an array
            const [movedSession] = state.sessions.splice(index, 1) 
            // puts the session to the front
            state.sessions.unshift(movedSession)
        }
    })
}

const clearActiveSession = (set: SessionSet) => {

    set((state) => {
        state.activeSessionId = null
    })
}