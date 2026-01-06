
import React from 'react'
import { useBoundStore } from './store/useBoundStore'

/**
 * Q: Why are we use atomic subscriptions for each Tile AND memoizing the Row and Grid components?
 * A: https://docs.google.com/document/d/1onzRIhRcf7CKvWGrOVloScZ38eEFEieaWlV-BFSTvoU/edit?usp=sharing 
 * 
 * Q: Why not just have the Grid subscribe to the whole board and pass down props?
 * A: It would cause all tiles to re-render on any state change, leading to performance issues.
 * 
 * Q: ~
 * A: ~
 */

// Grid component: the main entry point for the game board 
// ------------------------------------------------------------------------
export default function Grid() {

    const board = useBoundStore((state) => state.board)

    // GUARD: If the board hasn't been synced/created yet, return null
    if (!board || board.length === 0) {
        return <div className="grid-loading">Initializing Grid...</div>
    }

    // We ask the store for the height of the board only to force re-render when the board changes
    const rowCount = board.length

    return (
        <div className="grid">
            <p>Debug: Session Active - {useBoundStore.use.activeSessionId()}</p>
            {/* We create an array of "Empty" slots just to map over them */}
            {Array.from({length: rowCount}).map((_, rowIndex) => (
                <Row key={rowIndex} rowIndex={rowIndex} />
            ))}
        </div>
    )
}
// Row component: the structure for each row of tiles
// ------------------------------------------------------------------------

// React.memo is a higher-order component that memoizes the result.
const Row = React.memo(function Row({ rowIndex }: { rowIndex: number }) {
    const wordLength = useBoundStore.use.wordLength()

    // Create a simple array of indexes: [0, 1, 2, 3, 4]
    const tileIndices = Array.from({ length: wordLength }, (_, i) => i);

    return (
        <div className="row" style={{ display: 'flex' }}>
            {tileIndices.map((tileIndex) => (
                <Tile 
                    key={tileIndex} 
                    rowIndex={rowIndex} 
                    tileIndex={tileIndex} 
                />
            ))}
        </div>
    )
})

// Tile component: atomic subscriber to its own state
// ------------------------------------------------------------------------

const Tile = ({rowIndex, tileIndex}: {rowIndex: number, tileIndex: number}) => {

    // This hook creates a targeted subscription. 
    // This tile is now "ignorant" of the rest of the board.
    const tile = useBoundStore((state) => state.board[rowIndex][tileIndex])

    const getStyles = (status: string, letter: string) => {
        switch (status) {
            case 'correct': 
                return { bg: '#528C4D', border: '#528C4D', text: 'white' } // Green
            case 'present': 
                return { bg: '#B59F3B', border: '#B59F3B', text: 'white' } // Yellow
            case 'absent':  
                return { bg: '#787C7E', border: '#787C7E', text: 'white' } // Gray
            default: 
                // Clear/Empty state: use #F8F8F8 for the background
                // If a letter is present but not submitted, make the border slightly darker
                return { 
                    bg: '#F8F8F8', 
                    border: letter ? '#878a8c' : '#D3D6DA', 
                    text: 'black' 
                }
        }
    }

    const styles = getStyles(tile.status, tile.letter)
    
    return (
        <div 
            // className="tile" 
            style={{
                border: `2px solid ${styles.border}`,
                backgroundColor: styles.bg,
                width: "62px",
                height: "62px",
                margin: "4px",
                textAlign: "center",
                lineHeight: "62px",
                fontSize: "32px",
                fontWeight: "bold",
                transition: "background-color 0.5s ease, border-color 0.5s ease",
                color: styles.text
            }}
            > {tile.letter}
        </div>
    )
}