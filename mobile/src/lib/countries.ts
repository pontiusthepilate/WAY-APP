import { all } from "country-codes-list";

export interface Country {
  name: string;
  iso2: string;
  dialCode: string; // digits only, no leading "+"
  flag: string;
}

const DEFAULT_COUNTRY_ISO2 = "NG";

function buildCountryList(): Country[] {
  const countries = all()
    .filter((c) => c.countryCallingCode)
    .map((c) => ({
      name: c.countryNameEn,
      iso2: c.countryCode,
      dialCode: c.countryCallingCode,
      flag: c.flag,
    }));

  countries.sort((a, b) => a.name.localeCompare(b.name));

  // Nigeria is the app's home market — pinned first in the list and used as
  // the default selection, ahead of the regular alphabetical order.
  const defaultIndex = countries.findIndex((c) => c.iso2 === DEFAULT_COUNTRY_ISO2);
  if (defaultIndex > 0) {
    const [defaultCountry] = countries.splice(defaultIndex, 1);
    countries.unshift(defaultCountry);
  }

  return countries;
}

export const COUNTRIES: Country[] = buildCountryList();
export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

// Longest dial code first, so a 3-digit code (e.g. "234") is tried before a
// shorter one that happens to be its prefix.
const BY_DIAL_CODE_LENGTH = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

// Resolves an E.164 identifier like "+2348012345678" back to the country its
// dial code belongs to — purely cosmetic (e.g. showing a flag next to an
// already-chosen number), not used for anything that depends on getting the
// single "correct" country among ones that share a calling code (+1, etc).
export function findCountryByIdentifier(identifier: string): Country | null {
  if (!identifier.startsWith("+")) return null;
  const digits = identifier.slice(1);
  return BY_DIAL_CODE_LENGTH.find((c) => digits.startsWith(c.dialCode)) ?? null;
}
