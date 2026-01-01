import { useEffect, useState } from 'react';
import './Game.css'

interface TileData {
    letter: string;
    status: 'empty' | 'absent' | 'present' | 'correct';
}

const createGameBoard = (wordLength: number): TileData[][] => {
    // Create an array of 6 rows, for each row create an array of {wordLength} tiles
    return Array.from({ length: 6 }, () =>
        Array.from({ length: wordLength }, () => ({
            letter: '',
            status: 'empty' as TileData['status'], // "as" type casting when colon used in object literal
        }))
    );
    // Returns:
    // [
    //   [{letter: '', status: 'empty'}, {letter: '', status: 'empty'}...], // Row 0
    //   [{letter: '', status: 'empty'}, {letter: '', status: 'empty'}...], // Row 1
    //   ...
    // ]
}

export default function Game() {

    const [board, setBoard] = useState<TileData[][]>(createGameBoard(5))
    const [currentRow, setCurrentRow] = useState(0);
    const [currentTile, setCurrentTile] = useState(0)

    useEffect(() => {
        const handlePhysicalKeyPress = (event: KeyboardEvent) => {
            const key = event.key
            
            if (key === 'Enter') {
                handleKeyPress('Enter');
            } else if (key === 'Backspace') {
                handleKeyPress('Backspace');
            } else if (/^[a-zA-Z]$/.test(key)) {
            // This regex ensures we only capture A-Z, not "Shift" or "Control"
            // RegExp.test(string: string): boolean
            // Returns a Boolean value that indicates whether or not a pattern exists in a searched string.
                handleKeyPress(key.toUpperCase());
            }
        }

        // Listen's for global keypresses and sends them to handleKeyPress
        window.addEventListener('keydown', handlePhysicalKeyPress); // Attach event listener on mount

        // To React, the return value of an effect is reserved for cleanup functions/logic
        return () => window.removeEventListener('keydown', handlePhysicalKeyPress); // Cleanup on unmount

        // Empty dependency array [] ensures this effect runs only once on mount and cleanup on unmount
        // Will change this later for Zustand state management (per tile updates)
    }, [board, currentRow, currentTile])

    const handleKeyPress = (key: string) => {
        if (key === 'Enter') {
            console.log('Enter key pressed');
            //  if (currentTile === wordLength) --> submit, increment row, reset tile
            // else give visual cue that word is incomplete
            if (currentTile === board[0].length) {
                if (currentRow < board.length - 1) {
                    setCurrentRow(currentRow + 1)
                    setCurrentTile(0)
                } else {
                    console.log('No more rows left')
                }
            } else {
                console.log('Current row is incomplete')
            }
        } else if (key === 'Backspace') {
            console.log('Backspace key pressed')
            if (currentTile > 0) {

                const newBoard = [...board]
                
                const newCurrentRow = [...newBoard[currentRow]]

                // Since the current pointer is at the next empty tile, we need to go back one
                newCurrentRow[currentTile-1] =  { letter: '', status: 'empty'}

                newBoard[currentRow] = newCurrentRow

                setBoard(newBoard) 
                setCurrentTile(currentTile - 1)
            }
        } else {
            console.log(`Key pressed: ${key}`)
            if (currentTile < board[0].length) {

                /*
                Copy Board.
                Copy Row.
                Update Row.
                Put Row back in Board.
                */

                // Get a copy of the current board
                // At this point newBoard is a newList but the rows are still references to the old rows
                const newBoard = [...board]
                
                // Get a copy of the current row
                // Ex: newBoard[0] --> [TileData, TileData, TileData, TileData, TileData]
                // We take the current row from the newBoard (which is still a reference to the old row)
                // and create a new array from it to avoid mutating state directly
                const newCurrentRow = [...newBoard[currentRow]]
                
                // Update the current row
                // Ex: newCurrentRow[0] --> {letter: '', status: 'empty'}
                // We update the current tile in the current row with the new letter
                newCurrentRow[currentTile] = { letter: key, status: 'empty'} // status is empty until submission
                
                // Insert the updated current row into the new board
                // Ex: newBoard[0] --> updated newCurrentRow
                // We replace the current row in the newBoard with the updated newCurrentRow
                // The memory reference of newBoard changes here, triggering React state update
                newBoard[currentRow] = newCurrentRow

                setBoard(newBoard)
                setCurrentTile(currentTile + 1)

            } else {
                console.log('Row is full, cannot add more letters')
            }
        }
    }

    return (
    <>
    <h1>Wordle</h1>
    <Grid board={board} />
    <br></br>
    <VirtualKeyboard onKeyPress={handleKeyPress} />
    </>

    )
}

// Virtual Keyboard Component

const VirtualKeyboard = ({ onKeyPress }: {onKeyPress: (key: string) => void}) => {

    const keys: string[][] = [
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L'],
        ['Enter','Z','X','C','V','B','N','M','Backspace'],
    ]

    return (
        <div className="keyboard-container">
            {keys.map((row, rowIndex) => (
                    // When using map, always provide a unique key prop
                    <div key={rowIndex} className="keyboard-row">
                    {row.map((keyLabel) => (
                        // For each row, render the keys
                        // Send value of key up to Game component
                        <Key key={keyLabel} keyLabel={keyLabel} onClick={onKeyPress}/>
                    ))}
                    </div>
                ))}
        </div>
    )
}

interface KeyProps {
    keyLabel: string;
    onClick: (key: string) => void;
}
const Key = ({keyLabel, onClick} : KeyProps) => {
    
    const isLarge = keyLabel === 'Enter' || keyLabel === 'Backspace';

    // default onClick passes key up to VirtualKeyboard
    return (
        <button className={`key ${isLarge ? 'large' : ''}`} onClick={() => onClick(keyLabel)}>
            {keyLabel}
        </button>
    )
}

// Grid Component
const Grid = ({board}: {board: TileData[][]}) => {

    return (
        <div className="grid">
            {board.map((rowData, rowIndex) => (
                <Row key={rowIndex} rowData={rowData} />
            ))}
        </div>
    )
}

const Row = ({rowData}: {rowData: TileData[]}) => {

    return (
        <div className="row">
            {rowData.map((tileData, tileIndex) => (
                <Tile key={tileIndex} tileData={tileData} />
            ))}
        </div>
    )
}

const Tile = ({tileData} : {tileData: TileData}) => {

    // State data for each tile could include:
    // letter (A-Z)
    // status (correct, present, absent)
    return (
        <div 
            // className="tile" 
            style={{
                border: "2px solid #D3D6DA",
                width: "62px",
                height: "62px",
                margin: "4px",
                textAlign: "center",
                lineHeight: "62px",
                fontSize: "32px",
                fontWeight: "bold",}}
            > {tileData.letter}
        </div>
    )
}