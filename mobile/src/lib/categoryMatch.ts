// Lets the category picker accept a free-text sentence ("I love cooking
// and hiking on weekends") instead of requiring the exact taxonomy name —
// scores every INTERESTS entry by token overlap against the query and
// returns the best matches. Deliberately simple (no backend/LLM call):
// the taxonomy is a few hundred fixed, mostly-plain-English tags, so
// word-overlap scoring already catches the common case ("cooking" in the
// sentence directly matching the "Cooking" tag) without new infra.
import { INTERESTS } from "./interests";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "to", "of", "in", "on", "at", "with", "is", "are", "am",
  "i", "im", "my", "me", "we", "our", "you", "your", "someone", "somebody", "anyone", "who", "that",
  "this", "these", "those", "looking", "look", "want", "wanting", "need", "needing", "like", "likes",
  "love", "loves", "into", "about", "something", "things", "thing", "find", "finding", "person",
  "people", "interested", "interest", "interests", "please", "really", "very", "just", "can", "could",
  "would", "should", "it", "its", "be", "been", "being", "do", "does", "doing", "if", "so", "near",
  "nearby", "someone's", "who's", "all",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Crude singular normalization (cars -> car, hobbies -> hobbie) — close
// enough for word-overlap scoring without pulling in a stemming library.
function normalize(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

const TAGGED = INTERESTS.map((interest) => ({
  name: interest.name,
  nameTokens: tokenize(interest.name).map(normalize),
  groupTokens: tokenize(interest.group).map(normalize),
  lowerName: interest.name.toLowerCase(),
}));

export function matchCategories(query: string, limit = 8): string[] {
  const queryTokens = new Set(tokenize(query).map(normalize));
  if (queryTokens.size === 0) return [];
  const lowerQuery = query.toLowerCase();

  const scored = TAGGED.map((t) => {
    let score = 0;
    for (const token of t.nameTokens) if (queryTokens.has(token)) score += 2;
    for (const token of t.groupTokens) if (queryTokens.has(token)) score += 1;
    if (lowerQuery.includes(t.lowerName)) score += 3;
    return { name: t.name, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.name);
}
