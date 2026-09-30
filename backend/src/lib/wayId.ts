// A WAY-ID (what users socially call "your WAY") is a unique handle, 3-20
// chars, lowercase letters/digits/underscore, must start with a letter.
const WAY_ID_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export function isValidWayId(value: string): boolean {
  return WAY_ID_PATTERN.test(value);
}

export function normalizeWayId(value: string): string {
  return value.trim().toLowerCase();
}
