import { queryClient } from './queryClient'
import { isWord, isCommon, isClean, isRoot} from './wordService'
import { wordApi, type WordProfile } from './wordApi'

const QUEUE_SIZE = 10
const refillingStatus: Record<number, boolean> = {}

/**
 * Retrieve the current preloaded queue for the specified word length.
 *
 * @remarks
 * Reads the cached query data keyed by ['wordQueue', length]. If no data exists,
 * returns an empty array. This is a synchronous helper that only reads from the
 * query cache and does not trigger network activity.
 *
 * @param length - The word length whose queue should be returned.
 * @returns An array of queued words (may be empty).
 */
export function getQueue(length: number): string[] {
    return queryClient.getQueryData<string[]>(['wordQueue', length]) || []
}

/**
 * Ensure the word queue for the given length is filled up to QUEUE_SIZE.
 *
 * @remarks
 * If the current queue has fewer than QUEUE_SIZE entries, this function will fetch
 * additional word profiles (via getRandomWordProfile) until the queue reaches QUEUE_SIZE.
 * Only successful profiles (profile.word !== 'ERROR') are appended. The combined
 * queue is then written back to the query cache under ['wordQueue', length].
 * Network requests occur only when the queue is not already full.
 *
 * @param length - Desired word length to maintain in the preload queue.
 */
export async function refillQueue(length: number) {

    if (refillingStatus[length]) return

    let currentQueue = getQueue(length)
    if(currentQueue.length >= QUEUE_SIZE) return

    refillingStatus[length] = true

    try {
        const needed = QUEUE_SIZE - currentQueue.length
        const newWords: string[] = []

        let attempts = 0
        const MAX_ATTEMPTS = 20

        while(newWords.length < needed && attempts < MAX_ATTEMPTS) {
            attempts++
            // Since getRandomWordProfile calls wordApi.fetchProfile, it will be cached in the WordProfile query cache
            const profile = await getRandomWordProfile(length)
            if(profile.word !== 'ERROR') {
                newWords.push(profile.word)
            }
            
        }

        queryClient.setQueryData(
            ['wordQueue', length], // addressing the queue for this length
            (currentWords: string[] | undefined) => {
                const combinedWords = [...(currentWords || []), ...newWords]
                return combinedWords.slice(0, QUEUE_SIZE); // Hard ceiling of 10, we dont want more than 10 words in a queue
            }
        )

    } catch (error) {
        console.error(`Refill failed for length ${length}:`, error)
    } finally {
        // Always release the lock, even if there was an error
        refillingStatus[length] = false
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
export async function getRandomWordProfile(wordLength: number, discarded: string[] = []): Promise<WordProfile> {

    while (true) {
        try {

            const word = await wordApi.fetchRandomWord(wordLength)
            if (!word) throw new Error('No word returned from Random Word API')
 
            // Initialize the validator w/closure for this specific word
            const profile = await wordApi.fetchProfile(word)

            // The pipeline uses the methods we built into the 'candidate' closure
            if (isWord(profile) && 
                isCommon(profile) && 
                isClean(profile) && 
                await isRoot(profile)
            ) {
                if (discarded.length > 0) console.log(`Discarded words: ${discarded.join(', ')}`)
                
                return profile
            }

            // If it failed any check, we track it and loop again
            discarded.push(word)

        } catch (error) {
            console.error('Random Word API error:', error)
            return { word: 'ERROR', frequency: 0, definitions: [], status: 'error' }
        }
    }
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
    return isWord(profile);
}

/**
 * Retrieve the next game word for the given length from the preload queue.
 *
 * @remarks
 * Pops the first word from the cached ['wordQueue', length]. If the queue is empty,
 * performs an emergency fetch for a single word and triggers a background refill.
 * After removing the word, updates the cached queue and initiates refillQueue(length)
 * to replenish the queue asynchronously. Returns the chosen word as a string.
 *
 * @param length - Desired word length for the next game word.
 * @returns A Promise resolving to the next word (string).
 */
export async function getNextGameWord(length: number): Promise<string> {

    const queue = getQueue(length)

    // Emergency fetch if queue is empty
    if (queue.length === 0) {
        console.warn(`Queue empty for length ${length}. Fetching emergency word...`);
        const profile = await getRandomWordProfile(length);
        // We trigger a full refill in the background for next time
        refillQueue(length); 
        console.log(`FETCHED EMERGENCY WORD: ${profile.word.toUpperCase()}`)
        return profile.word.toUpperCase();
    }

    // queue is a simple array of strings
    // nextWord: gets index 0 
    // ...remainingQueue: copies everything after index 0 to new array
    const [nextWord, ...remainingQueue] = queue

    // Save the shortened list back to the cache/LocalStorage
    queryClient.setQueryData(['wordQueue', length], remainingQueue)

    refillQueue(length)

    return nextWord
}