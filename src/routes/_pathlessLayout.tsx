import Header from '@/ui/Header'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_pathlessLayout')({
  component: PathlessLayoutComponent,
})

function PathlessLayoutComponent() {
  return (
    <div className='min-h-screen w-full bg-game'>
      <Header />
      <Outlet/>
    </div>
  )
}