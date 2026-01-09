import { type TileData } from './gameSlice'
import dayjs from 'dayjs'
import { getNextGameWord, refillQueue } from '../data/wordManager'
import {type StateCreator} from 'zustand'
import { type Draft } from 'immer'
import { type BoundState } from './useBoundStore'
import { queryClient } from '../queryClient'

export interface GameSession {

    // Identity
    id: string

    // The Snapshot
    secretWord: string
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
    hasInitialized: boolean
    isGeneratingGame: boolean

    actions: {

        initialize: () => Promise<void> // Runs on app boot. Decides on which game session to provide.
        hydrateGame: (session: GameSession) => void
        syncGameState: () => Promise<void>
        startNewGame: (isFeatured: boolean) => Promise<void>
        resumeGame: (id: string) => void
        updateSession: (id: string, updates: any) => void
        clearActiveSession: () => void 
    }
}

// These types allow our handlers to be fully type-safe
export type SessionSet = (fn: (state: Draft<BoundState>) => void) => void
export type SessionGet = () => BoundState

/**
 * Create the session slice for the Zustand store.
 *
 * @remarks
 * Constructs the session portion of the global store, initializing default
 * session state values (sessions list, active pointer, preferences and locks)
 * and wiring action names to their concrete implementations. This slice
 * orchestrates session lifecycle (creation, hydration, resumption, updates)
 * and delegates runtime hydration into the game engine.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 */
export const createSessionSlice: StateCreator<
    BoundState,
    [["zustand/immer", never], ["zustand/persist", unknown]],
    [],
    SessionState
> = (set, get) => ({
    sessions: [],
    hasInitialized: false,
    activeSessionId: null,
    isGeneratingGame: false,

    actions: {
        initialize: async () => await initialize(set, get),
        syncGameState: async () => await syncGameState(set, get),
        hydrateGame: (session) => hydrateGame(set, session),
        startNewGame: async (isFeatured) => await startNewGame(set, get, isFeatured),
        resumeGame: (id) => resumeGame(set, get, id),
        updateSession: (id, updates) => updateSession(set, id, updates),
        clearActiveSession: () => clearActiveSession(set)
    }
})

/**
 * Returns true if the calendar day of `timestamp` is earlier than the current calendar day.
 *
 * @remarks
 * Compares only calendar day boundaries (ignores time-of-day) using dayjs.
 * Useful to decide whether a stored session should be considered "from today"
 * or belongs to a previous day (e.g., for daily puzzle rotation).
 *
 * @param timestamp - Unix ms timestamp to compare against now.
 */
const newDayArrivedSince = (timestamp: number) => {
  const now = dayjs()
  const last = dayjs(timestamp)

  // Is "now" after "last", comparing only the calendar day?
  return now.isAfter(last, 'day')
}


const createGameBoard = (): TileData[][] => {
    // Create an array of 6 rows, for each row create an array of 5 tiles
    return Array.from({ length: 6 }, () =>
        Array.from({ length: 5 }, () => ({
            letter: '',
            status: 'empty' as TileData['status'], // "as" type casting when colon used in object literal
        }))
    )
}

/**
 * Initialize session subsystem on app boot.
 *
 * @remarks
 * Runs once at startup: guards against double initialization, optionally
 * preloads background resources, inspects the most-recent cached session,
 * and if that session is from the same calendar day and still 'playing',
 * sets it active and hydrates it into the runtime engine. Marks initialization
 * as complete so this runs only once.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 */
const initialize = async (set: SessionSet, get: SessionGet) => {

    await hydrateWordQueue()

    if (get().hasInitialized) return
    
    await syncGameState(set, get)

    set((state) => { 
        state.hasInitialized = true 
    })
}

const syncGameState = async (set: SessionSet, get: SessionGet) => {
    
    if (get().isGeneratingGame) return
    
    const latestSession = get().sessions[0]
    
    // 1. Try to Resume
    let resumedId: string | null = null
    if (latestSession) {
        const isFresh = !newDayArrivedSince(latestSession.lastUpdated)
        const isUnfinished = latestSession.status === 'playing'
        if (isFresh && isUnfinished) resumedId = latestSession.id
    }

    // 2. Apply state
    set((state) => {
        state.activeSessionId = resumedId
        if (resumedId && latestSession) applyHydration(state, latestSession)
    })

    // 3. Create New if needed
    if (get().activeSessionId === null) {
        const isFeatured = !latestSession || newDayArrivedSince(latestSession.lastUpdated)
        await get().actions.startNewGame(isFeatured)
        refillQueue()
    }
}


/**
 * Apply hydration data from a stored GameSession onto the live bound state.
 *
 * @remarks
 * Maps the persisted snapshot into runtime state by:
 * - uppercasing and assigning the secret word,
 * - reusing or building a canonical board,
 * - computing currentRow from submitted rows,
 * - reconstructing the guesses list from submitted rows,
 * - clearing any transient unsubmittedGuess.
 * Mutates the provided Draft state in-place.
 *
 * @param state - Immer Draft of the BoundState to mutate.
 * @param session - The stored GameSession to apply.
 */
const applyHydration = (state: Draft<BoundState>, session: GameSession) => {
    state.secretWord = session.secretWord.toUpperCase()
    state.status = session.status
    
    // Ensure board structure
    state.board = (session.board && session.board.length > 0) 
        ? session.board 
        : createGameBoard()

    const submittedRows = state.board.filter(row => row[0].status !== 'empty').length
    state.currentRow = submittedRows
    state.guesses = state.board
        .filter((row) => row[0].status !== 'empty')
        .map((row) => row.map((tile) => tile.letter).join(''))
    
    state.unsubmittedGuess = '' 
}

/**
 * Hydrate an arbitrary GameSession into the active state.
 *
 * @remarks
 * Thin wrapper that schedules applyHydration inside the immer set callback
 * so the provided session snapshot is safely merged into the live store.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param session - The GameSession to hydrate.
 */
const hydrateGame = (set: SessionSet, session: GameSession) => {
    set((state) => applyHydration(state, session))
}

/**
 * Start a new game for the current preferred word length.
 *
 * @remarks
 * Coordinates new-session creation with a concurrency lock:
 * - sets isGeneratingGame to prevent duplicate generation,
 * - requests a secret word from the word manager,
 * - creates session metadata (id, timestamps, featured flag),
 * - inserts the new session at the front of sessions and hydrates runtime state,
 * - always clears the lock in a finally block so failures don't deadlock.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 * @param isFeatured - Whether the new game is featured.
 */
const startNewGame = async (set: SessionSet, get: SessionGet, isFeatured: boolean) => {

    if (get().isGeneratingGame) return

    // 🔒 The Lock: Set this BEFORE the 'await'
    set((state) => { state.isGeneratingGame = true })

    try {

        const secretWord = await getNextGameWord()

        const newGameSession = {
            id: crypto.randomUUID(),
            secretWord: secretWord,
            board: createGameBoard(),
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
}

/**
 * Resume an existing game session by id.
 *
 * @remarks
 * Looks up the session by id in the persisted sessions array. If found,
 * marks it active and invokes applyHydration so the runtime state reflects
 * the saved snapshot. Logs and returns early if no matching session exists.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param get - Store getter.
 * @param id - Session id to resume.
 */
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

/**
 * Update a stored GameSession by id with given fields.
 *
 * @remarks
 * Performs an in-place merge of provided fields onto the target session using
 * Object.assign, refreshes lastUpdated to now, and promotes the session to the
 * front of the sessions list so the most-recent session is first. No-op when
 * the id is not found.
 *
 * @param set - Store setter (immer Draft wrapper).
 * @param id - Session id to update.
 * @param updates - Partial updates to apply to the session.
 */
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

/**
 * Clear the currently active session (set activeSessionId to null).
 *
 * @remarks
 * Unsets the active session pointer without mutating persisted session entries.
 * Useful when navigating away from the active game or when cancelling a resume.
 *
 * @param set - Store setter (immer Draft wrapper).
 */
const clearActiveSession = (set: SessionSet) => {

    set((state) => {
        state.activeSessionId = null
    })
}

export async function hydrateWordQueue(): Promise<void> {

    await new Promise<void>((resolve) => {
        
        if (queryClient.getQueryData(['wordQueue']) !== undefined) {
            return resolve()
        }

        const unsubscribe = queryClient.getQueryCache().subscribe(() => {
            if (queryClient.getQueryData(['wordQueue']) !== undefined) {
                unsubscribe()
                resolve()
            }
        })

        setTimeout(() => {
            unsubscribe()
            resolve()
        }, 1000)
    })
}