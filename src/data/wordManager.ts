import { queryClient } from '../queryClient'
import { isWord, isCommon, isClean, isRoot} from './wordService'
import { wordApi, type WordProfile } from './wordApi'

const QUEUE_SIZE = 10
let isRefilling = false // prevents double refill while memory is not cleared

function getQueue(): string[] {
    const data = queryClient.getQueryData<string[]>(['wordQueue'])
    
    // Log the actual state so you can see the hydration working
    // console.log("Current Queue State:", data || [])
    
    return data || []
}


export async function refillQueue() {

    if (isRefilling) return
    isRefilling = true

    let currentQueue = getQueue()
    console.log(`[Refill Start] Sees ${currentQueue.length} words. Top: ${currentQueue[0]}`)

    if(currentQueue.length >= QUEUE_SIZE) return

    try {

        const needed = QUEUE_SIZE - currentQueue.length
        const newWords: string[] = []

        let attempts = 0
        const MAX_ATTEMPTS = 20

        while(newWords.length < needed && attempts < MAX_ATTEMPTS) {
            attempts++
            // Since getRandomWordProfile calls wordApi.fetchProfile, it will be cached in the WordProfile query cache
            const profile = await getRandomWordProfile()
            if(profile.word !== 'ERROR') {
                newWords.push(profile.word)
            }
            
        }

        queryClient.setQueryData(
            ['wordQueue'], // addressing the queue for this length
            (currentWords: string[] | undefined) => {
                const combinedWords = [...(currentWords || []), ...newWords]
                const final = combinedWords.slice(0, QUEUE_SIZE) // Hard ceiling of 10, we dont want more than 10 words in a queue
                console.log(`[Refill Commit] Saving queue. Top word is now: ${final[0]}`)
                return final
            }
        )

    } catch (error) {
        console.error(`Refill failed for length ${length}:`, error)
    } finally {
        // Always release the lock, even if there was an error
        isRefilling = false
    }
}

/**
 * Fetches and returns a random acceptable word of the requested length.
 *
 * @remarks
 * Repeatedly fetches a random candidate word, profiles it, and runs it through the
 * validation pipeline (isWord, isCommon, isClean, isRoot). If a word fails, it's added
 * to the discarded list and the loop continues until a valid word is found or an error occurs.
 *
 * @param wordLength - Desired length of the random word.
 * @param discarded - Optional array to collect discarded candidate words for logging.
 * @returns A Promise resolving to the chosen word in uppercase, or 'ERROR' on failure.
 */
export async function getRandomWordProfile(discarded: string[] = []): Promise<WordProfile> {

    const MAX_ATTEMPTS = 5
    const BATCH_SIZE = 20

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {

            const words = await wordApi.fetchRandomWords(BATCH_SIZE)

            if (!words || words.length === 0) {
                console.warn(`Attempt ${attempt}: API returned no words.`)
                continue // Try the next batch
            }
            
            for (const word of words) {
                const profile = await wordApi.fetchProfile(word)

                // The pipeline uses the methods we built into the 'candidate' closure
                if (isWord(profile) && 
                    isCommon(profile) && 
                    isClean(profile) && 
                    await isRoot(profile)
                ) {
                    // if (discarded.length > 0) console.log(`Discarded words: ${discarded.join(', ')}`)
                    
                    return profile
                }

                // If it failed any check, we track it and loop again
                discarded.push(word)
            }

        } catch (error) {
            console.error('Word API error, check https://random-words-api.kushcreates.com/', error)
            return { word: 'ERROR', frequency: 0, definitions: [], status: 'error' }
        }
    }
    console.error(`Even after ${MAX_ATTEMPTS*BATCH_SIZE} words,no valid word found. check https://random-words-api.kushcreates.com/`)
    return { word: 'NO_WORDS_FOUND', frequency: 0, definitions: [], status: 'error' }
}

/** 
 * Validates whether a guessed word is a valid word.
 *
 * @remarks
 * Fetches the word profile from the cache, disk, or API and checks if it meets the basic
 * validity criteria using the isWord validation function.
 *
 * @param guess - The word to validate.
 * @returns A Promise resolving to true if the word is valid; false otherwise.
 */
export async function validateGuess(guess: string): Promise<boolean> {
    // 1. Get the profile (Check cache/disk/API)
    const profile = await wordApi.fetchProfile(guess)

    // 2. Use your existing logic function to check it
    return isWord(profile)
}


export async function getNextGameWord(): Promise<string> {

    const queue = getQueue()
    console.log(`[Dequeue Start] Removing top word: ${queue[0]}. Queue length: ${queue.length}`)

    // Emergency fetch if queue is empty
    if (queue.length === 0) {
        const profile = await getRandomWordProfile()
        console.log(`FETCHED EMERGENCY WORD: ${profile.word.toUpperCase()}`)
        return profile.word.toUpperCase()
    }

    // queue is a simple array of strings
    // nextWord: gets index 0 
    // ...remainingQueue: copies everything after index 0 to new array
    const [nextWord, ...remainingQueue] = queue

    // Save the shortened list back to the cache/LocalStorage
    queryClient.setQueryData(['wordQueue'], remainingQueue)

    console.log(`[Dequeue End] Word ${nextWord} removed. New top: ${remainingQueue[0]}`)

    return nextWord
}