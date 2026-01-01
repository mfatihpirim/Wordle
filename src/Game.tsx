
import './Game.css'
import Grid from './Grid';
import Keyboard from './Keyboard';
import { useEffect } from 'react'
import { useGameStore } from './useGameStore'

export default function Game() {
    
    // LOAD GAME ON MOUNT
    const loadGame = useGameStore((state) => state.loadGame)
    
    // The loadGame action function never changes, so this effectively ensures the code only runs once (on page load).
    useEffect(() => {loadGame()}, [loadGame])

    return (
    <>  
        <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '75vh',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
        <h1>Wordle</h1>
        <Grid/>
        <br/>
        <Keyboard />
        </div>

    </>

    )
}


