import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Since words don't change, we never want them to expire during a session
      staleTime: Infinity, 
      
      // gcTime (Garbage Collection) determines how long data stays in 
      // the cache before being deleted. To keep your preloaded words 
      // available for a week, we set it to 7 days.
      gcTime: 1000 * 60 * 60 * 24 * 7, 

      // Prevents the app from re-fetching every word when the user 
      // switches back to the browser tab.
      refetchOnWindowFocus: false,
    },
  },
})

// https://docs.google.com/document/d/1gprRUb5oluF9TJysVzZH4IIVloSkhazulGj_zidMxyw/edit?usp=sharing

// The data lives in localStorage, which persists even when the browser is closed
export const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  // throttleTime batches all preloaded words into a single write every 1000ms, so the UI stays smooth.
  throttleTime: 1000, 
})
