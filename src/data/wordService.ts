import { Filter } from 'bad-words'
import { wordApi, type WordProfile } from './wordApi'

/**
 * Determines whether a WordProfile should be considered low quality based on definitions.
 *
 * @remarks
 * Scans the profile.definitions array for any acceptable definitions (i.e., definitions that
 * do not contain banned keywords such as "dated", "archaic", "slang", etc.). Also treats
 * missing or empty definitions as low quality.
 *
 * @param profile - The WordProfile to evaluate.
 * @returns True when the profile is considered low quality and should be skipped.
 */
export function isLowQuality(profile: WordProfile): boolean {

    const { word, definitions } = profile

    if (!definitions || definitions.length === 0) {
        // console.log(`Skipping "${word}" - Reason: No definitions found`)
        return true
    }

    const bannedKeywords = [
        'dated', 'archaic', 'obsolete', 'rare', 'slang', 
        'surname', 'dialect', 'scientific', 'latin', 'prefix', 'suffix',
        'biblical', 'given name'
    ]

    // Build the master regex once
    const regex = new RegExp(`\\b(${bannedKeywords.join('|')})\\b`, 'i')

    // Look for at least one "innocent" definition: .some() loops through the array
    // and returns true the moment it finds a definition without any banned keywords.
    const hasCleanDefinition = definitions.some(def => {
        // Remove the part-of-speech prefix (e.g., "n\t") to check only the text
        const cleanDef = def.includes('\t') ? def.split('\t')[1] : def
        // If regex.test is false (no banned words), !regex.test becomes true
        return !regex.test(cleanDef)
    })

    if (!hasCleanDefinition) {
        // console.log(`Skipping "${word}" - Reason: no "quality" definitions found.`)
        return true
    }

    return false
}

/**
 * Checks whether a profile represents a valid word for use.
 *
 * @remarks
 * Rejects profiles with error or not_found statuses. Also treats low-quality profiles
 * with low frequency as invalid words.
 *
 * @param profile - The WordProfile to validate.
 * @returns True if the profile is considered a valid word; false otherwise.
 */
export function isWord(profile: WordProfile): boolean {
    if (profile.status === 'error') return false
    if (profile.status === 'not_found') return false

    // Low quality words are also considered non-words
    if (isLowQuality(profile) && profile.frequency < 1.0) {
        // console.log(`Skipping "${word}" - Reason: Low quality definition`)
        return false
    }

    return true
}

/**
 * Determines whether a word is common enough based on frequency.
 *
 * @remarks
 * Compares profile.frequency to a threshold (default 1.0) to decide if the word is common.
 *
 * @param profile - The WordProfile to check.
 * @param threshold - Frequency cutoff to consider a word common.
 * @returns True if profile.frequency >= threshold.
 */
export function isCommon(profile: WordProfile, threshold: number = 1.0): boolean {
    return profile.frequency >= threshold
}

/**
 * Detects simple inflections by comparing word frequency to candidate root forms.
 *
 * @remarks
 * For words ending with 's' or 'ed', generates likely root candidates (e.g., 'beers' -> 'beer')
 * and fetches their profiles. If a candidate root is more frequent than the word, the word
 * is considered an inflection and not a root. Returns true when the word should be treated
 * as a root form.
 *
 * @param profile - The WordProfile of the word to test.
 * @returns A Promise resolving to true if the word is a root; false if it appears to be an inflected form.
 */
export async function isRoot(profile: WordProfile): Promise<boolean> {
    
    const { word, status } = profile

    // Guard clause
    if (status === 'not_found' || status === 'error') return true

    // 1. word is root if word length less than 3
    // 2. word is root if it ends with 'ss'
    if(word.endsWith('SS')) return true
    
    const suffixMap = {
        'S':  [word.slice(0, -1)],
        'ED': [word.slice(0, -2), word.slice(0, -2) + 'E']
    }

    for (const suffix in suffixMap) {
        if (word.endsWith(suffix)) {
            // Type assertion to let TS know we are using valid keys
            const candidates = suffixMap[suffix as keyof typeof suffixMap]
            
            for (const root of candidates) {
                const rootFreq = (await wordApi.fetchProfile(root)).frequency
                
                // if the given word is "pants", it is technically not a root
                // but since pant.freq !> pants.freq we still return true (pants is considered a root)
                
                if (rootFreq > profile.frequency) return false
            }
        }
    }
    // word is a root if the above checks did not eliminate it
    return true
}

const filter = new Filter()
/**
 * Checks whether the profile's word is free of profane language.
 *
 * @remarks
 * Uses the 'bad-words' Filter to detect profanity in the lowercased word.
 *
 * @param profile - The WordProfile containing the word to check.
 * @returns True when the word is clean (no profanity detected).
 */
export function isClean(profile: WordProfile): boolean {
    const { word } = profile
    return !filter.isProfane(word.toLocaleLowerCase())
}

