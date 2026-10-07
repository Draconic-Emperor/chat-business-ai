// Pure helpers (no Convex imports) shared by the chat engine, mutations
// and queries.

/** "KES 1,500" / "KES 1,499.50" */
export function formatKES(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.004;
  return (
    "KES " +
    rounded.toLocaleString("en-KE", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Canonical key used to match a product mentioned in chat against an
 * inventory item — case/punctuation insensitive, singular, and maps the
 * most common Swahili product words to their English equivalents.
 */
const PRODUCT_ALIASES: Record<string, string> = {
  mashati: "shirt",
  viatu: "shoe",
  kalamu: "pen",
  soksi: "sock",
  nguo: "cloth",
  mavazi: "cloth",
  mayai: "egg",
  mahindi: "maize",
  ndizi: "banana",
  matunda: "fruit",
  mboga: "vegetable",
  sukari: "sugar",
  unga: "flour",
  chai: "tea",
  kahawa: "coffee",
  sabuni: "soap",
  mafuta: "oil",
  mkate: "bread",
  maziwa: "milk",
};

export function productKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
  if (!base) return "";
  const singular =
    base.endsWith("s") && base.length > 3 ? base.slice(0, -1) : base;
  return PRODUCT_ALIASES[singular] ?? singular;
}

/** Key used to match customer names typed in chat. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
