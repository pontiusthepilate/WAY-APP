// Server-side counterpart to mobile's categoryMatch.ts: extracts the
// significant words from a free-text "describe what you're looking for"
// search query, used to ILIKE-match against Profile.whichWay (see
// geo.ts's findNearbyProfiles). Trimmed port of the same stopword/tokenize
// philosophy so the two stay conceptually consistent, not a shared import
// (mobile and backend don't share a module boundary in this repo).
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "to", "of", "in", "on", "at", "with", "is", "are", "am",
  "i", "im", "my", "me", "we", "our", "you", "your", "someone", "somebody", "anyone", "who", "that",
  "this", "these", "those", "looking", "look", "want", "wanting", "need", "needing", "like", "likes",
  "love", "loves", "into", "about", "something", "things", "thing", "find", "finding", "person",
  "people", "interested", "interest", "interests", "please", "really", "very", "just", "can", "could",
  "would", "should", "it", "its", "be", "been", "being", "do", "does", "doing", "if", "so", "near",
  "nearby", "all",
]);

export function significantWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)];
}
