// Capitalizes a display name for presentation — person, business, podcast,
// or anything else shown via the `displayName` field. Only touches names
// that are entirely lowercase as typed (no uppercase letter anywhere);
// anything with existing capitalization is left exactly as-is, since that
// signals deliberate stylization ("iPhone Repairs", "McDonald", "WAY Ltd")
// that a blind title-case would otherwise mangle.
export function formatDisplayName(name: string): string {
  if (!name || /[A-Z]/.test(name)) return name;
  return name
    .split(" ")
    .map((word) => (word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}
