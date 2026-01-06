
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createGameSlice, type GameState } from './gameSlice'
import { createSessionSlice, type SessionState } from './sessionSlice'
import type { StoreApi, UseBoundStore } from 'zustand'

// 1. Define the Bound State Type
// This represents the "Whole World" of your application state
export type BoundState = GameState & SessionState

const useBoundStoreBase = create<BoundState>()(
    persist(
        immer((...a) => {
            const game = createGameSlice(...a)
            const session = createSessionSlice(...a)

            return {
                ...game,
                ...session,
                // Manually merge the actions so one doesn't overwrite the other
                actions: {
                    ...game.actions,
                    ...session.actions,
                },
            }
        }),
        {
            name: 'wordle-app-storage',
            storage: createJSONStorage(() => localStorage),
            // Do not persist actions
            partialize: (state) => {
                const { actions, ...rest } = state
                return rest
            },
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.actions.initialize();
                    console.log("🔄 PERSIST LOADED", state?.sessions.length)
                }
            },
        }
    )
)

// https://zustand.docs.pmnd.rs/guides/auto-generating-selectors

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

export const useBoundStore = createSelectors(useBoundStoreBase)