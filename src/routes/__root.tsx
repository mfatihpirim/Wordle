import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import Header from '../ui/Header'

export const Route = createRootRoute({ component: RootComponent })

function RootComponent() {

  return (
    <>
      {/* This stays on the screen no matter what, like a nav bar */}
      <Header/>

      <hr />

      <Outlet />
      
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackRouterDevtools />
    </>
  )
}


