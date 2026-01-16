import Grid from './Grid'
import Keyboard from './Keyboard'

export default function Game() {
  return (
    <main>
      <div className="mt-16 md:mt-30">
        <Grid />
      </div>
      <div className="mt-16 md:mt-22 px-4">
        <Keyboard />
      </div>
    </main>
  )
}
