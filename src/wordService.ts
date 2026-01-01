// Learning Tip:
// An async function automatically wraps its return value in a Promise. 
// Even if you just wrote return true, because the function is async, it actually returns Promise.resolve(true).
// https://youtu.be/spvYqO_Kp9Q?si=2XX0d6nwV-ydLHw8 

// API's used:
// 2. Datamuse API to check word existence and frequency: https://www.datamuse.com/api/
// 3. Random Word API to fetch random words: https://random-word-api.herokuapp.com/

// Bugs Encountered:
// 1. isWord always returning false nonsensically because of rate limiting by Dictionary API, Solution: changed to datamuse completely
// -----------------------------------------------------------------------------------------------

import { Filter } from 'bad-words'

// Initialize the filter once to avoid repeated overhead
// We can customize the filter if needed by adding or removing words
// Purpose: to filter out offensive words from being selected as game words
const filter = new Filter();

/**
 * Fetches a random common word of specified length.
 * Uses the createWordValidator to ensure the word is common, 
 * exists, and is a root word (not a simple plural/past tense).
 */
export async function getRandomWord(wordLength: number, discarded: string[] = []): Promise<string> {
    
    // const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        try {

            // Helper function to prevent rate limiting
            const response = await fetch(`https://random-word-api.herokuapp.com/word?length=${wordLength}`);
            
            if (!response.ok) {
                console.error('Random Word API failed');
                return 'ERROR';
            }

            // Simple and direct naming as requested
            const word = (await response.json())[0];

            // Initialize the validator closure for this specific word
            const candidate = await createWordValidator(word);

            // The pipeline uses the methods we built into the 'candidate' closure
            if (candidate.exists() && candidate.isCommon() && await candidate.isRoot() && candidate.isClean()) {
                // console.log(`Accepted word: ${word}`);
                if (discarded.length > 0) {
                    console.log(`Discarded words: ${discarded.join(', ')}`);
                }
                return word.toUpperCase();
            }

            // If it failed any check, we track it and loop again
            discarded.push(word);
            
            // await sleep(200); 

        } catch (error) {
            console.error('Random Word API error:', error);
            return 'ERROR';
        }
    }
}

async function createWordValidator(word: string) {
    
    word = word.toLocaleLowerCase()
    const wordFreq = await getFrequency(word)
    const exists = wordFreq !== 0 // If it's 0, it doesn't exist. If -1, it's an error.

    return {
        exists: () => exists,

        /**
         * Checks if a word is common enough based on its frequency tag from Datamuse API
         * A word is common if its frequency is higher than the set threshhold (by default=.4)
         */
        isCommon: (threshold: number = 1.0): boolean => {
            return wordFreq >= threshold;
        },

        /**
         * Detects common inflections (plurals, conjugates) by comparing the 
         * word's frequency to its potential root (e.g., 'beers' vs 'beer').
         * * Mechanism: If a word ends in -s or -ed and its root form is more frequent, 
         * it is flagged as inflected. The function returns false for inflected words.
         * * Limitation/Feature: Does not catch irregular inflections (geese, women) or 
         * some modern suffixes (-ing, -er).
         */
        isRoot: async function(): (Promise<boolean>) {

            // 1. word is root if word does not exist
            // 2. word is root if word length less than 3
            // 3. word is root if it ends with 'ss'
            if(!exists || word.length < 3 || word.endsWith('ss')) return true
            
            const suffixMap = {
                's':  [word.slice(0, -1)],
                'ed': [word.slice(0, -2), word.slice(0, -2) + 'e']
            };

            for (const suffix in suffixMap) {
                if (word.endsWith(suffix)) {
                    // Type assertion to let TS know we are using valid keys
                    const candidates = suffixMap[suffix as keyof typeof suffixMap];
                    
                    for (const root of candidates) {
                        const rootFreq = await getFrequency(root);
                        
                        // word is not a root if:
                            //  the derived word from it IS a root and is more frequent than it
                        // edge case: if the derived word does not exist, its freq will be 0
                        // and the true will be returned by default
                        if (rootFreq > wordFreq) return false;
                    }
                }
            }
            // word is a root if the above checks did not eliminate it
            return true
        },
        isClean: ()=> {
            return !filter.isProfane(word);
        }
        // Additional validators can be added here as needed
    }
}

/**
 * A utility function that fetches the frequency score for a single word.
 * Returns -1 if the network/API fails, and 0 if the word doesn't exist.
 */
async function getFrequency(word: string): Promise<number> {
    try {
        // Fetch only the top result (max=1) and request metadata (md=f) for frequency
        const response = await fetch(`https://api.datamuse.com/words?sp=${word}&md=dpsrf&max=1`);
        
        // Handle HTTP errors (like 404 or 500)
        if (!response.ok) return -1;

        const data = await response.json();

        // If the API returns an empty array, the word doesn't exist
        if (!data || data.length === 0 || !data[0].tags || !data[0].word) {
            // console.log(`No data found for word: "${word}"`);
            return 0;
        }

        // If the returned word doesn't match the queried word, it doesn't exist
        // This happens due to fuzzy matching by the Datamuse API
        // An api call for "dawts" returns "darts"
        if (data[0].word !== word.toLowerCase()) {
            // console.log(`Mismatched word: queried "${word}", got "${data[0].word}"`);
            return 0
        }
        
        // The frequency tag looks like "f:12.3456"
        // We find the tag that starts with "f:", split it, and grab the number
        const fTag = data[0].tags.find((t: string) => t.startsWith('f:'));
        
        const frequency: number = fTag ? parseFloat(fTag.split(':')[1]) : 0;
        
        // Built in Quality Filter (The "Banned Context" Gate)
        // If the word is low quality AND its frequency is low, we discard it
        if (isLowQuality(word, data[0].defs) && frequency < 1.0) {
            console.log(`Skipping "${word}" - Reason: Low quality definition`);
            return 0;
        }

        return frequency

    } catch (error) {
        // Handle network crashes or JSON parsing errors
        console.error('Frequency fetch error:', error);
        return -1;
    }
}

/**
 * Checks if a given word exists in the dictionary.
 * Returns true if the word exists, false otherwise.
 */
export async function isWord(word: string): Promise<boolean> {
    const freq = await getFrequency(word);
    // If freq is 0, the word doesn't exist. 
    // If it's -1, there was an error.
    return freq > 0; 
}

/**
 * Internal helper to log and filter out "low quality" words.
 * Low quality words are those that have definitions tagged with
 * undesirable keywords like "dated", "slang", "rare", etc.
 * Parameters:
 *   - word: the word being evaluated
 *   - definitions: array of definition strings
 * Returns:
 *   - true if the word is low quality and should be discarded
 *   - false if the word is acceptable
 */
function isLowQuality(word: string, definitions: string[] = []): boolean {
    
    if (!definitions || definitions.length === 0) {
        console.log(`Skipping "${word}" - Reason: No definitions found`);
        return true;
    };

    const bannedKeywords = [
        'dated', 'archaic', 'obsolete', 'rare', 'slang', 
        'surname', 'dialect', 'scientific', 'latin', 'prefix', 'suffix'
    ];

    // Build the master regex once
    const regex = new RegExp(`\\b(${bannedKeywords.join('|')})\\b`, 'i');

    // Look for at least one "innocent" definition: .some() loops through the array
    // and returns true the moment it finds a definition without any banned keywords.
    const hasCleanDefinition = definitions.some(def => {
        // Remove the part-of-speech prefix (e.g., "n\t") to check only the text
        const cleanDef = def.includes('\t') ? def.split('\t')[1] : def;
        // If regex.test is false (no banned words), !regex.test becomes true
        return !regex.test(cleanDef)
    })

    if (!hasCleanDefinition) {
        // console.log(`Skipping "${word}" - Reason: no "quality" definitions found.`);
        return true; 
    }

    return false
}

// Manual test runner to visualize the word selection process
// Uncomment to run standalone tests
// async function runTest() {
//     for (let i = 0; i < 40; i++) {
//         // 'await' here ensures test 1 finishes before test 2 starts
//         const word = await getRandomWord(5); 
//         console.log("FINAL RESULT:", word);
//         console.log("-------------------");
//     }
// }
// runTest();
