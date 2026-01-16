import PlayerRank from './player-rank'
import { Button } from './ui/button'
import { House } from 'lucide-react'
import { CircleQuestionMark } from 'lucide-react'
import { History } from 'lucide-react'
import { ChartNoAxesColumn } from 'lucide-react'
import { ToggleRight } from 'lucide-react'
// import { ToggleLeft } from 'lucide-react'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import DiceFill from '../assets/dice-fill.svg?react'
import Shuffle from './shuffle'
import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'

import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const shuffleRef = useRef<{ handleRoll: () => void }>(null)

  const closeSidebar = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Menu Icon acts as the button */}
        <Menu className="size-8 md:size-10 text-foreground/90 cursor-pointer transition-all hover:opacity-80" />
      </SheetTrigger>

      <SheetContent side="right">
        {' '}
        {/* 'side' prop controls where it slides from */}
        <SheetHeader className="h-20 md:h-22 gap-4 flex flex-row md:justify-end md:pr-26">
          <SheetTitle className="sr-only">Side Bar Nav Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Access your profile, rank, and game settings.
          </SheetDescription>
          {/* Place holder for profile */}
          <div className="size-12 rounded-full bg-muted" />
          <PlayerRank />
        </SheetHeader>
        <nav className="flex-1 px-6 md:px-8 flex-row">
          <ul className="flex flex-col gap-4">
            {/* Home */}
            <li>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="w-full text-xl flex flex-row justify-start items-center gap-6"
              >
                <Link to="/">
                  <House strokeWidth={2.0} className="size-8" />
                  <span className="translate-y-[2.5px]">Home</span>
                </Link>
              </Button>
            </li>

            {/* Shuffle */}
            <li>
              <Button
                variant="ghost"
                size="lg"
                className="w-full text-xl flex flex-row justify-start items-center gap-6"
                onClick={() => {
                  shuffleRef.current?.handleRoll()
                  setTimeout(() => {
                    closeSidebar()
                  }, 1000)
                }}
              >
                <Shuffle ref={shuffleRef} className="size-8 text-foreground/90">
                  <DiceFill className="size-full" />
                </Shuffle>
                <span className="translate-y-[2.5px]">Shuffle</span>
              </Button>
            </li>

            {/* Tutorial */}
            <li>
              <Button
                disabled
                variant="ghost"
                size="lg"
                className="w-full text-xl flex flex-row justify-start items-center gap-6"
                onClick={closeSidebar}
              >
                <CircleQuestionMark strokeWidth={2.0} className="size-8" />
                <span className="translate-y-[2.5px]">Tutorial</span>
              </Button>
            </li>

            {/* History */}
            <li>
              <Button
                disabled
                variant="ghost"
                size="lg"
                className="w-full text-xl flex flex-row justify-start items-center gap-6"
                onClick={closeSidebar}
              >
                <History strokeWidth={2.0} className="size-8" />
                <span className="translate-y-[2.5px]">History</span>
              </Button>
            </li>

            {/* Statistics */}
            <li>
              <Button
                disabled
                variant="ghost"
                size="lg"
                className="w-full text-xl flex flex-row justify-start items-center gap-6"
                onClick={closeSidebar}
              >
                <ChartNoAxesColumn strokeWidth={3.0} className="size-8" />
                <span className="translate-y-[2.5px]">Statistics</span>
              </Button>
            </li>

            {/* Display */}
            <li>
              <Button
                disabled
                variant="ghost"
                size="lg"
                className="w-full text-xl flex flex-row justify-start items-center gap-6"
              >
                <ToggleRight strokeWidth={2.0} className="size-8" />
                <span className="translate-y-[2.5px]">Display</span>
              </Button>
            </li>
          </ul>
        </nav>
        <SheetFooter className="px-6 md:px-8 flex-row">
          <Button disabled variant="outline" className="w-full">
            Log in
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
