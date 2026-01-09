import { createFileRoute } from '@tanstack/react-router'
import Game from "../ui/Game.tsx"

export const Route = createFileRoute('/game')({
  component: GameComponent,
})

function GameComponent() {
  return (
    <>
        <Game/>
    </>
  )
}
