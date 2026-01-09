import { useEffect } from 'react';
import { useBoundStore } from '../store/useBoundStore'
import { getKeyboardStatusMap } from '../store/gameSlice'

const KEYS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
];

export default function Keyboard() {

    // STATE DATA IN STORE
    const status = useBoundStore.use.status()

    // KEYBOARD ACTIONS
    // Select only the actions we need
    // Using separate selectors to avoid unnecessary re-renders
    const { addLetter, removeLetter, submitGuess } = useBoundStore.use.actions()

    // Unified handler for physical and virtual input
    const handleInput = (key: string) => {
        
        if (status !== 'playing') return;

        if (key === 'Enter') submitGuess();
        else if (key === 'Backspace') removeLetter()
        else if (/^[A-Z]$/.test(key)) addLetter(key)
    };

    // Effect to handle physical keyboard input

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toUpperCase()
            if (key === 'ENTER') handleInput('Enter')
            else if (key === 'BACKSPACE') handleInput('Backspace')
            else if (/^[A-Z]$/.test(key)) handleInput(key);
        }

        window.addEventListener('keydown', onKeyDown);
    
        return () => window.removeEventListener('keydown', onKeyDown);
        // Added status and action functions to dependencies to avoid stale closures 
        // Especially for status
        // The physical keyboard listener needs the latest status value
    }, [addLetter, removeLetter, submitGuess, status]);

    return (
    <div className="keyboard-container">
        {KEYS.map((row, i) => (
        <div key={i} className="keyboard-row">
            {row.map((keyLabel) => (
            <Key 
                key={keyLabel} 
                keyLabel={keyLabel} 
                onClick={() => handleInput(keyLabel)} 
            />
            ))}
        </div>
        ))}
    </div>
    );
}

// Restoring the name to Key
interface KeyProps {
    keyLabel: string;
    onClick: (key: string) => void;
}

// Right now each key (unlike the tiles) subscribes to the store individually
// and must derive its own status based on the submitted guesses.
// The reduce logic runs everytime the board
const Key = ({ keyLabel, onClick }: KeyProps) => {

    const status = useBoundStore((state) => {
        const map = getKeyboardStatusMap(state)
        return map[keyLabel] || 'empty' 
    })

    const getBgColor = (status: string) => {
        switch(status) {
            case 'correct': return '#528C4D'
            case 'present': return '#B59F3B'
            case 'absent':  return '#787C7E'
            default:        return '#D3D6DA' // A light gray for unused keys
        }
    }

    const isLarge = keyLabel === 'Enter' || keyLabel === 'Backspace';

    return (
    <button 
        className={`key ${isLarge ? 'large' : ''}`} 
        onClick={() => onClick(keyLabel)}
        style={{
            backgroundColor: getBgColor(status),
            border: 'none'
        }}
    >
        {keyLabel}
    </button>
    )
}