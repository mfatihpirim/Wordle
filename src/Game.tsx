import { useEffect, useRef } from 'react';
import './Game.css';
import Grid from './Grid';
import Keyboard from './Keyboard';
import { useBoundStore } from './store/useBoundStore';

export default function Game() {
    const { initialize, startNewGame } = useBoundStore.use.actions();
    const hasInitialized = useBoundStore.use.hasInitialized();
    const activeSessionId = useBoundStore.use.activeSessionId();

    // Create the guard. 
    // This value is 'sticky'—it stays the same even if the component re-renders.
    // Changing .current does NOT trigger a re-render, which is what we want here.
    // isStarting is now the object { current: false }
    const isStarting = useRef(false);

    useEffect(() => {
        // 1. Wake up the store
        initialize();
    }, [initialize]);


    useEffect(() => {
        console.log(`has initialized: ${hasInitialized}, activesession ID: ${activeSessionId}`)
        // - The store has finished rehydrating (hasInitialized)
        // - There is no current active game (!activeSessionId)
        // - We haven't ALREADY triggered a start in this mount cycle (!isStarting.current)
        if (hasInitialized && !activeSessionId && !isStarting.current) {
            console.log("New game generating")

            isStarting.current = true
            startNewGame(false); // false = not a featured/daily word
        }
    }, [hasInitialized, activeSessionId, startNewGame]);

    if (!hasInitialized || !activeSessionId) {
        return <div className="loading">Generating Word...</div>;
    }

    return (
        <main className="game-container">
            <Grid />
            <Keyboard />
        </main>
    );
}