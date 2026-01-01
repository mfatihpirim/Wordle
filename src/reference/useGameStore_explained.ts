import {create} from 'zustand'

interface SimpleState {
    val: number;
    run: (input: string) => void;
}

/**
 * THE MACHINE (Higher-Order Function)
 * Note: 'workerFn' is a function that accepts a function and returns T
 */
function machine<T>(
    workerFn: (t: (msg: string) => void) => T
): T {

    // 1. Define the internal tool (the 'set' equivalent)
    function tool(msg: string): void {
        console.log("Updating:", msg);
    }

    // 2. Execute the worker function and inject the tool
    const result: T = workerFn(tool);

    // 3. Return the resulting object (SimpleState)
    return result;
}

/**
 * THE USAGE (The Store Creation)
 */
const app = machine<SimpleState>(function(t) {
    
    // We must return an object that matches the 'SimpleState' interface
    return {
        val: 10,
        
        // This is a method using a regular function
        run: function(input: string): void {
            // Closure: 't' is remembered from the outer function's parameter
            t(input);
        }
    };
});

// Testing
app.run("Hello from the verbose version!");


// _______________________________________________________________________________________
// _______________________________________________________________________________________
// _______________________________________________________________________________________

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

interface GameState {

    // Data (State)
    board: TileData[][],
    currentRow: number,
    currentTile: number

    // Logic (Action)
    addLetter: (key: string) => void;
    removeLetter: () => void;
    submitGuess: () => void;
}

// The only argument we pass to the inner function of create is the stateCreatorFn
// stateCreatorFn can take 3 args: set function, get function, and store
// In this case we are only defining set as an arg for stateCreatorFn
// set performs a shallow merge, meaning if only one property is updated, 
// the others remain untouched

export const useGameStore = create<GameState>((set) => ({

    board: createGameBoard(5),
    currentRow: 0,
    currentTile: 0,

    addLetter: (key) => set((state) => {
        // Logic
        return { currentTile: state.currentTile + 1}
    }),

    removeLetter: () => set((state) => ({

    })),

    submitGuess: () => set((state) => ({

    }))

}))

// _______________________________________________________________________________________

export const useGameStoreVERBOSE = create<GameState>(function(set) {
    // This is the "Outer Function" (The Construction Crew)
    
    return {
        // --- DATA ---
        board: createGameBoard(5),
        currentRow: 0,
        currentTile: 0,

        // Option: move actions to components for better organization

        // --- ACTIONS ---
        addLetter: function(key: string) {
            // This is the "Inner Function"
            // It uses 'set' from the outer function's arguments
            set(function(state) {
                // This is the "Update Logic"
                return { currentTile: state.currentTile + 1 };
            });
        },

        removeLetter: function() {
            set(function(state) {
                return { /* Logic here */ };
            });
        },

        submitGuess: function() {
            set(function(state) {
                return { /* Logic here */ };
            });
        }
    };
}
);

// _______________________________________________________________________________________

// Written here is the "External Action" pattern. It still works, but the "Magic" shifts 
// from Closure to Direct Reference.

// https://docs.google.com/document/d/19I8RpfppVlv006UIuOQxVu0UPLrXif5Q_yiXqrhuWIc/edit?usp=sharing

export const addLetter = (letter: string) => {

    return useGameStoreVERBOSE.setState((state) => {
        return { currentTile: state.currentTile + 1 };
    })
}

// _______________________________________________________________________________________


// Another example of an external action
// Zustand creators usually recommend putting actions inside (using the closure) because it’s easier to see the whole "contract" of the store in one interface.

// Large-scale apps often use your External pattern because it keeps the create block from becoming 500 lines long.

// 1. THE CREATION
// The Machine runs, returns the object, and assigns it to 'newStore'.
export const newStore = create<{counter: number}>(() => ({counter: 0})) 

/**
 * 2. DIRECT OBJECT UPDATE (The "Force")
 * You are passing a raw object. 
 * The machine takes this object and merges it directly into the state.
 * It DOES NOT look at the current state; it just overwrites.
 */
newStore.setState({ counter: 10 })

/**
 * 3. ANONYMOUS UPDATER (The "Simple Logic")
 * You are passing a function that returns an object.
 * The machine executes this function to get the new data.
 * Since you didn't ask for 'state' in the params, you can't see the current value.
 */
newStore.setState(() => ({ counter: 5 }))

/**
 * 4. THE STATE-AWARE UPDATER (The "Standard")
 * This is the most powerful version.
 * The machine passes its internal 'current state' into your callback.
 */
newStore.setState((state) => {
    // You now have access to the "live" data inside the machine
    console.log(state.counter) 
    
    // You return ONLY the parts you want to change (Shallow Merge)
    return {
        counter: state.counter + 1
    }
})

// WHERE TO PUT ACTIONS? (From the docs)
// https://zustand.docs.pmnd.rs/guides/practice-with-no-store-actions

interface Bound {
    count: number
    text: string
    inc: () => void
    setText: (text: string) => void
}

// OPTION 1 Colocation: Actions inside the create block (Closure)
// - Better encapsulation

export const useBoundStore = create<Bound>((set) => ({
  count: 0,
  text: 'hello',
  inc: () => set((state) => ({ count: state.count + 1 })),
  setText: (text) => set({ text }),
}))

// OPTION 2 External Actions: Actions outside the create block (Direct Reference)
// - Better organization for large stores

export const useBoundStore2 = create(() => ({
  count: 0,
  text: 'hello',
}))

export const inc = () =>
  useBoundStore2.setState((state) => ({ count: state.count + 1 }))

export const setText = (text: string) => useBoundStore2.setState({ text })