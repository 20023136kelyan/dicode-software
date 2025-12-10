/**
 * Text processing utilities for word cloud visualization
 * Used in peer comparison to analyze qualitative/text responses
 */

// Common English stopwords to filter out
const STOPWORDS = new Set([
  // Articles & determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'whose',
  // Verbs (common forms)
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'need', 'dare', 'ought', 'used',
  // Prepositions
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'out', 'off', 'over', 'up', 'down',
  // Conjunctions
  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
  'so', 'than', 'when', 'where', 'why', 'how',
  // Adverbs & others
  'then', 'once', 'here', 'there', 'all', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'too', 'very', 'just', 'also', 'now', 'both', 'any', 'many', 'much',
  'about', 'like', 'think', 'feel', 'really', 'well', 'even', 'still',
  'however', 'therefore', 'thus', 'hence', 'yet', 'already', 'always',
  // Common filler words
  'get', 'got', 'getting', 'go', 'going', 'went', 'make', 'made', 'making',
  'take', 'took', 'taking', 'come', 'came', 'coming', 'know', 'knew', 'knowing',
  'see', 'saw', 'seeing', 'want', 'wanted', 'wanting', 'use', 'using',
  'find', 'found', 'finding', 'give', 'gave', 'giving', 'tell', 'told', 'telling',
  'say', 'said', 'saying', 'thing', 'things', 'way', 'ways', 'lot', 'lots',
  'something', 'anything', 'nothing', 'everything', 'someone', 'anyone', 'everyone',
  'able', 'being', 'been', 'done', 'going', 'having', 'making', 'taking',
]);

/**
 * Tokenize text into meaningful words
 * - Converts to lowercase
 * - Removes punctuation
 * - Filters stopwords and short words
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\d+/g, ' ')       // Remove numbers
    .split(/\s+/)               // Split on whitespace
    .filter(word =>
      word.length > 2 &&        // At least 3 characters
      !STOPWORDS.has(word)      // Not a stopword
    );
}

/**
 * Get word frequencies from an array of text responses
 */
export function getWordFrequencies(responses: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();

  for (const response of responses) {
    const words = tokenize(response);
    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
  }

  return frequencies;
}

/**
 * Get top N words by frequency
 */
export function getTopWords(
  responses: string[],
  limit = 25
): Array<{ word: string; count: number }> {
  const freq = getWordFrequencies(responses);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Find which top words appear in a user's response
 */
export function getUserWordMatches(
  userResponse: string,
  topWords: Array<{ word: string }>
): Set<string> {
  const userWords = new Set(tokenize(userResponse));
  return new Set(
    topWords
      .filter(tw => userWords.has(tw.word))
      .map(tw => tw.word)
  );
}

/**
 * Calculate alignment percentage - how many of the user's meaningful words
 * appear in the top community words
 */
export function calculateWordAlignment(
  userResponse: string,
  topWords: Array<{ word: string }>
): number {
  const userWords = tokenize(userResponse);
  if (userWords.length === 0) return 0;

  const topWordSet = new Set(topWords.map(tw => tw.word));
  const matchingWords = userWords.filter(w => topWordSet.has(w));

  return Math.round((matchingWords.length / userWords.length) * 100);
}
