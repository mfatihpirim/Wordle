import { z } from 'zod'
import { queryClient } from './queryClient'

/**
 * Default HTTP fetcher used by the module.
 *
 * @remarks
 * A small wrapper around the Fetch API that enforces non-OK responses to throw.
 * This function is generic so callers can indicate the expected return shape,
 * but the runtime contract is not enforced here — use Zod validation at the
 * call site for safety.
 *
 * @typeParam T - Expected response shape.
 * @param url - Resource URL to fetch.
 * @returns A promise resolving to the parsed JSON payload cast to T.
 */
let _fetcher = <T>(url: string): Promise<T> => 
    fetch(url).then(res => {
        if (!res.ok) {
            throw new Error(`Network response was not ok: ${res.statusText}`)
        }
        return res.json() as Promise<T>
    })

// Swaps the internal fetcher. Essential for unit testing without the internet
/**
 * Replace the module's internal fetch implementation.
 *
 * @remarks
 * Useful for tests or environments that need to control HTTP responses. The
 * custom fetcher must follow the same signature as the default _fetcher.
 *
 * @param customFetcher - A function that takes a URL and returns a Promise<T>.
 */
export const injectFetcher = (customFetcher: typeof _fetcher): void => {
    _fetcher = customFetcher
}

/**
 * Zod schema representing a single Datamuse word result.
 *
 * @remarks
 * Captures the shape returned by Datamuse including optional metadata fields.
 */
const DatamuseWordSchema = z.object({
    word: z.string(),
    score: z.number().optional(),
    numSyllables: z.number().optional(),
    tags: z.array(z.string()).default([]),
    defs: z.array(z.string()).default([]),
})

/**
 * Zod schema for the array response from Datamuse.
 *
 * @remarks
 * Datamuse endpoints return an array of results, so we validate that the
 * response is an array of DatamuseWordSchema entries.
 */
const DatamuseArraySchema = z.array(DatamuseWordSchema)

/**
 * Structured profile describing a word's metadata used across the app.
 *
 * @remarks
 * frequency is parsed from Datamuse tag "f:..." when available. status
 * indicates how to treat the profile: 'success' means valid data was found,
 * 'not_found' when no matching word was returned, and 'error' for network
 * or parsing failures.
 */
export interface WordProfile {
    word: string
    frequency: number
    definitions: string[]
    status: 'success' | 'not_found' | 'error'
}

export const wordApi = {
    
    /**
     * Namespace for word-related remote operations.
     *
     * @remarks
     * Provides helpers to fetch Datamuse data, a random word service, and to
     * normalize/produce a consistent WordProfile with caching via queryClient.
     * Individual methods carry their own detailed documentation.
     */
    /**
     * Fetches Datamuse metadata for a specific word and validates it with Zod.
     *
     * @remarks
     * Calls Datamuse with md=dpsrf to request metadata and definitions, then parses
     * the unknown response with a Zod schema to ensure a consistent return shape.
     *
     * @param word - The word to query (case-insensitive).
     * @returns A promise resolving to an array of Datamuse word objects (validated).
     */
    fetchDatamuseData: async (word: string) => {
        const url = `https://api.datamuse.com/words?sp=${word.toLowerCase()}&md=dpsrf&max=1`;
        // TypeScript is very strict with unknown. It won't let you do anything with rawData 
        // (like rawData[0].word) because it doesn't know if rawData is even an object.
        const rawData = await _fetcher<unknown>(url);
        // Validate at the border!
        return DatamuseArraySchema.parse(rawData);
    },

    /**
     * Fetches a random word of the requested length from the random-word API.
     *
     * @remarks
     * The remote endpoint returns a string array; this function returns the first
     * element and does not perform additional schema validation.
     *
     * @param length - Desired length of the random word.
     * @returns A promise resolving to the chosen random word string.
     */
    fetchRandomWord: async (length: number) => {
        const url = `https://random-word-api.herokuapp.com/word?length=${length}`
        const rawData = await _fetcher<string[]>(url)
        return rawData[0] // No Zod needed here as it's a simple string array
    },

    /**
     * Builds a WordProfile for a given word by querying Datamuse and extracting
     * frequency and definitions.
     *
     * @remarks
     * Handles Datamuse fuzzy-matching by verifying returned word equality, parses
     * frequency tags (f:...), and returns structured WordProfile objects. On errors
     * returns a profile with status 'error'.
     *
     * @param word - The normalized word to profile (lowercased before use).
     * @returns A promise resolving to a WordProfile describing frequency, definitions, and status.
     */
    getWordProfile: async (word: string): Promise<WordProfile> => {
    
        try {
    
            const data = await wordApi.fetchDatamuseData(word)

            if (data.length === 0) return { word, frequency: 0, definitions: [], status: 'not_found' }

            // If the returned word doesn't match the queried word, it doesn't exist
            // This happens due to fuzzy matching by the Datamuse API
            // An api call for "dawts" returns the profile for "darts"
            if (data[0].word !== word.toLowerCase()) return { word, frequency: 0, definitions: [], status: 'not_found' }

            // The frequency tag looks like this: "f:12.3456"
            // We find the tag that starts with "f:", split it, and grab the number
            const fTag = data[0].tags.find((t: string) => t.startsWith('f:'))
            const frequency: number = fTag ? parseFloat(fTag.split(':')[1]) : 0

            const definitions = data[0].defs

            word = word.toUpperCase()

            return { word, frequency, definitions, status: 'success' }

        } catch (error) {
            // Handle network crashes or JSON parsing errors
            console.error('Frequency fetch error:', error)
            return { word, frequency: -1, definitions: [], status: 'error' }
        }
    },

    /**
     * Retrieves a cached or freshly fetched WordProfile using the query client.
     *
     * @remarks
     * Normalizes the input, then delegates to queryClient.ensureQueryData which will
     * return cached data if available or call getWordProfile to fetch and cache it.
     *
     * @param word - The input word to normalize and fetch a profile for.
     * @returns A promise resolving to the WordProfile.
     */
    fetchProfile: async (word: string): Promise<WordProfile> => {

        const normalizedWord = word.toLowerCase().trim()

        // ensureQueryData is an asynchronous function that can be used to get an existing query's cached data. 
        // If the query does not exist, queryClient.fetchQuery will be called and its results returned.
        // The result is cached for future calls.
        return await queryClient.ensureQueryData({
            queryKey: ['wordProfile', normalizedWord],
            queryFn: () => wordApi.getWordProfile(normalizedWord),
        })
    }
}





