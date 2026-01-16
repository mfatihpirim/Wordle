import { createFileRoute } from '@tanstack/react-router'
import Game from '../components/Game' // Make sure this path to your Game component is correct

export const Route = createFileRoute('/_pathlessLayout/game')({
  component: GameRoute,
})

function GameRoute() {
  return <Game />
}