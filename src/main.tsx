import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client' // 👈 Change this
import { queryClient, persister } from './queryClient' // 👈 Import your persister

import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      {/* Swap the provider and pass the persister config */}
      <PersistQueryClientProvider 
        client={queryClient} 
        persistOptions={{ persister }}
      >
        <RouterProvider router={router} />
      </PersistQueryClientProvider>
    </StrictMode>,
  )
}