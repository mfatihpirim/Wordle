import './Game.css';
import Grid from './Grid';
import Keyboard from './Keyboard';

export default function Game() {
   
    return (
        <main className="game-container">
            <Grid />
            <Keyboard />
        </main>
    )
}