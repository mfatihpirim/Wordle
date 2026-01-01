import type { TileData } from './useGameStore'
import {create} from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import dayjs from 'dayjs'

// Example:
// If lastUpdated was 11:59 PM yesterday and it is now 12:01 AM today:
// hasNewDayArrived(1767243540000) -> true
const newDayArrivedSince = (timestamp: number) => {
  const now = dayjs();
  const last = dayjs(timestamp);

  // Is "now" after "last", comparing only the calendar day?
  return now.isAfter(last, 'day');
}

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

interface SessionState {

    // 1. Data

    sessions: GameSession[] 
    activeSessionId: string | null 
    wordQueues: Record<number, string[]> // words of different lengths are preloaded into queues 
    isRefilling: Record<number, boolean>
    preferredWordLength: number
    hasInitialized: boolean
    minWordQueueSize: number
    maxWordQueueSize: number

    // 2. Lifecycle & Initialization

    // Runs on app boot. Decides on which game session to provide (fetch recent or generate new)
    initialize: () => void

    // Background worker. Checks if the queue for a specific word length is low and fetches a batch of words
    refillWordQueues: () => void

    refillWordQueue: (queueOfWordLength: number) => void

    // 3. Session Management

    // The "producer":
    //  - Pops a word from the correct queue, 
    //  - Generates a unique ID
    //  - Creates a new game session
    //  - Sets the game session as active
    // Ex1: User is shown the featured word of the day for the first time
    // Ex2: User shuffles the board and a new game is generated
    startNewGame: (isFeatured: boolean) => void

    // The "selector":
    // Sets the activeSessionId to an existing session form history
    // Ex1: Most recent game is loaded
    // Ex2: User selects and resumes a past game from drop down
    resumeGame: (id: string) => void

    // The "syncer":
    // Merges changes (like a new guess) from the Game Shell into the history
    // Stamps it with a new lastUpdated time
    // Ex1: User submits their third guess. This function is called in the game shell to sync it with session.
    updateSession: (id: string, updates: any) => void

    // 4. Cleanup & Maintenance
    
    // Called when navigating back to the Home screen. 
    // Sets activeSessionId to null without deleting the game
    clearActiveSession: () => void

    // Clear very old games
    // pruneHistory: () => void

}

const useSessionStoreBase = create<SessionState>()(
    immer((set, get) => ({

        sessions: [],
        hasInitialized: false,
        activeSessionId: null,

        wordQueues: {4: [], 5: [], 6: [], 7: []},
        isRefilling: {4: false, 5: false, 6: false, 7: false},
        minWordQueueSize: 5,
        maxWordQueueSize: 10,

        preferredWordLength: 5,
        
        /**
         * Ensure initialize is only ever called once (e.g., in a useEffect with an empty 
         * dependency array and a hasInitialized flag).
         */
        initialize: () => {

            // Guard clause to avoid initialization more than once
            if (get().hasInitialized) return

            const latestSession = get().sessions[0]

            // If no previous game session
            if (!latestSession) {
                set({ activeSessionId: null })
            // If it's a new day since latest session
            } else if (newDayArrivedSince(latestSession.lastUpdated)) {
                set({ activeSessionId: null })
            // If the latest session was not complete 
            } else if (latestSession.status === 'playing') {
                set({ activeSessionId: latestSession.id })
            } else {
                set({ activeSessionId: null })
            }
            
            set({ hasInitialized: true })
        },

        refillWordQueues: () => {

        },

        refillWordQueue: (queueOfWordLength: number) => {

            // Guard clause
            if (get().isRefilling[queueOfWordLength]) return
            // Ex: isRefilling = {4: false, 5: true, 6: false, 7: false}
            // Set the queue for the arg wordlength to "refilling"
            set((state) => {
                state.isRefilling[queueOfWordLength] = true
            })





            
        },

        startNewGame: (isFeatured: boolean) => {

        },

        resumeGame: (id: string) => {

        },

        updateSession: (id: string, updates: any) => {
            
        },

        clearActiveSession: () => {

        }

    })))

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

export const useSessionStore = createSelectors(useSessionStoreBase)


            // const latestSession = sessions[0]

            // // If no previous game sessions
            // if (sessions.length <= 0) {
            //     return startNewGame(true)
            // } 
            
            // // If it's a new day since latest session
            // if (newDayArrivedSince(latestSession.lastUpdated)) {
            //     return startNewGame(true)
            // } 

            // // If the latest session was not complete 
            // if(latestSession.status === 'playing') {
            //     return resumeGame(latestSession.id)
            // } 
            
            // return startNewGame(false)


