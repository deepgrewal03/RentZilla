import towns from "../constants/punjabTowns.json";

// Imported verbatim from rentzilla_punjab_towns_1795145845617.xlsx.
export const punjabTowns: Record<string, string[]> = towns;
export const districts = Object.keys(punjabTowns);
const normalize = (value: string) => value.toLowerCase().replace(/[().]/g, " ").replace(/\s+/g, " ").trim();
const aliases: Record<string, string> = {
  "mohali": "sas nagar",
  "s a s nagar": "sas nagar",
  "ferozepur": "firozpur",
  "ropar": "rupnagar",
  "rupnagar ropar": "rupnagar",
  "sas nagar mohali": "sas nagar",
  "shaheed bhagat singh nagar nawanshahr": "shaheed bhagat singh nagar",
  "muktsar": "sri muktsar sahib",
  "dasuya": "dasua",
  "sunam": "sunam udham singh wala",
};
const canonical = (value: string) => aliases[normalize(value)] ?? normalize(value);

/** Conservative mapping of saved, comma-separated location components.
 * Never match a provider name, description, road substring, or guess which
 * district a duplicated town name belongs to.
 */
export function resolveCatalogLocation(location: string): { district: string; town: string | null } | null {
  const components = location.split(/[,;\n|]/).map(part => canonical(part
    .replace(/\b(?:district|distt|dist)\.?\s*/gi, "")
    .replace(/\b\d{6}\b/g, ""))).filter(Boolean);
  const explicit = districts.filter(d => components.includes(canonical(d)));
  if (explicit.length > 1) return null;
  const candidates = districts.flatMap(district =>
    punjabTowns[district].filter(town => components.includes(canonical(town)))
      .map(town => ({ district, town })));
  const possible = explicit.length ? candidates.filter(c => c.district === explicit[0]) : candidates;
  const districtNames = [...new Set(possible.map(c => c.district))];
  if (!explicit.length && districtNames.length !== 1) return null;
  const district = explicit[0] ?? districtNames[0];
  if (!district) return null;
  // "Jagraon, Ludhiana" names a town followed by its district, not two towns.
  const specific = possible.filter(c => canonical(c.town) !== canonical(district));
  const town = specific.length === 1 ? specific[0].town
    : specific.length === 0 && possible.length === 1 ? possible[0].town : null;
  return { district, town };
}

export function matchesCatalogLocation(location: string, district: string, town: string): boolean {
  if (!district) return true;
  const resolved = resolveCatalogLocation(location);
  return resolved?.district === district && (!town || resolved.town === town);
}

export function matchesCatalogListing(
  listing: { category: string; subcategory?: string | null; location: string; isAvailable: boolean; providerId: string },
  category: string, type: string, district: string, town: string, viewerId?: string,
): boolean {
  return listing.category === category
    && listing.subcategory?.trim().toLowerCase() === type.trim().toLowerCase()
    && listing.isAvailable && listing.providerId !== viewerId
    && matchesCatalogLocation(listing.location, district, town);
}
