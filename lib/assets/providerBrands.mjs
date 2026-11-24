/**
 * Well-known UK financial providers (owner decision 23 Nov 2026): a logo where the repository holds one, otherwise
 * a tile in the firm's own colour with its initial. Logos live under /logos/finance (repository-owned files; the
 * card and payment marks are CC0 glyphs from Simple Icons; 33 more came from Wikimedia Commons on 24 Nov 2026, public
 * domain or Creative Commons, credited in public/logos/finance/CREDITS.md and on the terms page; 34 more are the official app icons from the
 * providers' own websites, also 24 Nov 2026). Brand changes: Clydesdale Bank shows Virgin Money, Prudential (UK)
 * shows M&G and Phoenix shows Standard Life, because their own websites now redirect there. Colours are approximate brand colours, used only for the
 * tile. Anything not listed still gets a tile, in a steady colour picked from its name.
 */
const L = (key, ext = "svg") => `/logos/finance/${key}.${ext}`;

export const PROVIDER_BRANDS = [
  // Banks and building societies
  { key: "barclays", name: "Barclays", type: "bank", color: "#00AEEF", logo: L("barclays", "png"), terms: ["barclays", "barclaycard"] },
  { key: "hsbc", name: "HSBC", type: "bank", color: "#DB0011", logo: L("hsbc", "png"), terms: ["hsbc"] },
  { key: "lloyds", name: "Lloyds", type: "bank", color: "#006A4D", logo: L("lloyds", "png"), terms: ["lloyds", "lloyds bank", "lloyds tsb"] },
  { key: "natwest", name: "NatWest", type: "bank", color: "#42145F", logo: L("natwest", "png"), terms: ["natwest", "nat west", "national westminster"] },
  { key: "rbs", name: "Royal Bank of Scotland", type: "bank", color: "#1D3D78", logo: L("rbs", "png"), terms: ["rbs", "royal bank of scotland"] },
  { key: "nationwide", name: "Nationwide", type: "bank", color: "#00205B", logo: L("nationwide", "png"), terms: ["nationwide"] },
  { key: "monzo", name: "Monzo", type: "bank", color: "#14233C", logo: L("monzo", "png"), terms: ["monzo"] },
  { key: "starling", name: "Starling", type: "bank", color: "#3B2A55", logo: L("starling", "png"), terms: ["starling"] },
  { key: "revolut", name: "Revolut", type: "bank", color: "#191C1F", logo: L("revolut", "png"), terms: ["revolut"] },
  { key: "co-operative", name: "Co-operative Bank", type: "bank", color: "#00573F", logo: L("co-operative", "png"), terms: ["co-operative bank", "co-op bank", "cooperative bank", "co operative bank"] },
  { key: "virgin-money", name: "Virgin Money", type: "bank", color: "#CC0000", logo: L("virgin-money"), terms: ["virgin money", "virgin"] },
  { key: "metro-bank", name: "Metro Bank", type: "bank", color: "#D6001C", logo: L("metro-bank"), terms: ["metro bank", "metrobank"] },
  { key: "chase", name: "Chase", type: "bank", color: "#117ACA", logo: L("chase"), terms: ["chase", "jp morgan chase", "jpmorgan"] },
  { key: "citibank", name: "Citibank", type: "bank", color: "#003B70", logo: L("citibank"), terms: ["citibank", "citi"] },
  { key: "deutsche-bank", name: "Deutsche Bank", type: "bank", color: "#0018A8", logo: L("deutsche-bank"), terms: ["deutsche bank", "deutsche"] },
  { key: "wise", name: "Wise", type: "bank", color: "#9FE870", logo: L("wise"), terms: ["wise", "transferwise"] },
  { key: "paypal", name: "PayPal", type: "bank", color: "#003087", logo: L("paypal"), terms: ["paypal"] },
  { key: "n26", name: "N26", type: "bank", color: "#48AC98", logo: L("n26"), terms: ["n26"] },
  { key: "bunq", name: "bunq", type: "bank", color: "#3394D7", logo: L("bunq"), terms: ["bunq"] },
  { key: "santander", name: "Santander", type: "bank", color: "#EC0000", logo: L("santander", "png"), terms: ["santander", "abbey national"] },
  { key: "halifax", name: "Halifax", type: "bank", color: "#005EB8", logo: L("halifax", "png"), terms: ["halifax"] },
  { key: "bank-of-scotland", name: "Bank of Scotland", type: "bank", color: "#003C71", logo: L("bank-of-scotland", "png"), terms: ["bank of scotland"] },
  { key: "tsb", name: "TSB", type: "bank", color: "#1E4A9C", logo: L("tsb", "png"), terms: ["tsb"] },
  { key: "first-direct", name: "first direct", type: "bank", color: "#000000", logo: L("first-direct", "png"), terms: ["first direct", "firstdirect"] },
  { key: "ulster-bank", name: "Ulster Bank", type: "bank", color: "#1D3D78", logo: L("ulster-bank", "png"), terms: ["ulster bank"] },
  { key: "bank-of-ireland", name: "Bank of Ireland", type: "bank", color: "#0033A0", logo: L("bank-of-ireland", "png"), terms: ["bank of ireland"] },
  { key: "aib", name: "AIB", type: "bank", color: "#7F2B7B", logo: L("aib", "png"), terms: ["aib", "allied irish"] },
  { key: "danske", name: "Danske Bank", type: "bank", color: "#003755", logo: L("danske", "png"), terms: ["danske"] },
  { key: "tesco-bank", name: "Tesco Bank", type: "bank", color: "#00539F", logo: L("tesco-bank", "png"), terms: ["tesco bank"] },
  { key: "sainsburys-bank", name: "Sainsbury’s Bank", type: "bank", color: "#F06C00", logo: L("sainsburys-bank", "png"), terms: ["sainsburys bank", "sainsbury's bank"] },
  { key: "ms-bank", name: "M&S Bank", type: "bank", color: "#1F1F1F", logo: L("ms-bank", "png"), terms: ["m&s bank", "m and s bank", "marks and spencer bank"] },
  { key: "atom", name: "Atom bank", type: "bank", color: "#3D2C8D", logo: L("atom", "png"), terms: ["atom bank", "atom"] },
  { key: "zopa", name: "Zopa", type: "bank", color: "#1F2A44", logo: L("zopa", "png"), terms: ["zopa"] },
  { key: "kroo", name: "Kroo", type: "bank", color: "#1E1E1E", logo: L("kroo", "png"), terms: ["kroo"] },
  { key: "chip", name: "Chip", type: "bank", color: "#1F1A3D", logo: L("chip", "png"), terms: ["chip"] },
  { key: "yorkshire-bs", name: "Yorkshire Building Society", type: "bank", color: "#00A4E4", logo: L("yorkshire-bs", "png"), terms: ["yorkshire building society", "ybs"] },
  { key: "coventry-bs", name: "Coventry Building Society", type: "bank", color: "#0E2A50", logo: L("coventry-bs", "png"), terms: ["coventry building society", "coventry bs"] },
  { key: "skipton-bs", name: "Skipton Building Society", type: "bank", color: "#003F7D", logo: L("skipton-bs", "png"), terms: ["skipton"] },
  { key: "leeds-bs", name: "Leeds Building Society", type: "bank", color: "#00857C", logo: L("leeds-bs", "png"), terms: ["leeds building society"] },
  { key: "post-office", name: "Post Office", type: "bank", color: "#DA291C", logo: L("post-office", "png"), terms: ["post office money", "post office"] },
  { key: "ns-and-i", name: "NS&I", type: "bank", color: "#00205B", logo: L("ns-and-i", "png"), terms: ["ns&i", "nsandi", "national savings", "premium bonds"] },
  { key: "triodos", name: "Triodos", type: "bank", color: "#00A19A", logo: L("triodos", "png"), terms: ["triodos"] },
  { key: "coutts", name: "Coutts", type: "bank", color: "#1D2B4F", logo: L("coutts", "png"), terms: ["coutts"] },
  { key: "clydesdale", name: "Clydesdale Bank", type: "bank", color: "#1D3D78", logo: L("virgin-money"), terms: ["clydesdale"] },
  // Cards and payments
  { key: "american-express", name: "American Express", type: "card", color: "#2E77BC", logo: L("american-express"), terms: ["american express", "amex"] },
  { key: "mastercard", name: "Mastercard", type: "card", color: "#EB001B", logo: L("mastercard"), terms: ["mastercard"] },
  { key: "visa", name: "Visa", type: "card", color: "#1A1F71", logo: L("visa"), terms: ["visa"] },
  { key: "klarna", name: "Klarna", type: "card", color: "#FFB3C7", logo: L("klarna"), terms: ["klarna"] },
  { key: "capital-one", name: "Capital One", type: "card", color: "#004879", logo: L("capital-one", "png"), terms: ["capital one"] },
  { key: "mbna", name: "MBNA", type: "card", color: "#003C71", logo: L("mbna", "png"), terms: ["mbna"] },
  // Investments, platforms and crypto
  { key: "coinbase", name: "Coinbase", type: "investment", color: "#0052FF", logo: L("coinbase"), terms: ["coinbase"] },
  { key: "binance", name: "Binance", type: "investment", color: "#F0B90B", logo: L("binance"), terms: ["binance"] },
  { key: "hargreaves-lansdown", name: "Hargreaves Lansdown", type: "investment", color: "#0A2F5C", logo: L("hargreaves-lansdown", "png"), terms: ["hargreaves lansdown", "hargreaves", "hl"] },
  { key: "aj-bell", name: "AJ Bell", type: "investment", color: "#E8471C", logo: L("aj-bell", "png"), terms: ["aj bell", "ajbell", "youinvest"] },
  { key: "interactive-investor", name: "interactive investor", type: "investment", color: "#4B1E78", logo: L("interactive-investor", "png"), terms: ["interactive investor", "ii.co.uk"] },
  { key: "vanguard", name: "Vanguard", type: "investment", color: "#96151D", terms: ["vanguard"] },
  { key: "fidelity", name: "Fidelity", type: "investment", color: "#368727", logo: L("fidelity", "png"), terms: ["fidelity"] },
  { key: "trading-212", name: "Trading 212", type: "investment", color: "#0090FF", logo: L("trading-212", "png"), terms: ["trading 212", "trading212"] },
  { key: "freetrade", name: "Freetrade", type: "investment", color: "#1F2332", logo: L("freetrade", "png"), terms: ["freetrade"] },
  { key: "etoro", name: "eToro", type: "investment", color: "#13C636", logo: L("etoro", "png"), terms: ["etoro"] },
  { key: "nutmeg", name: "Nutmeg", type: "investment", color: "#1C1C3A", logo: L("nutmeg", "png"), terms: ["nutmeg"] },
  { key: "moneybox", name: "Moneybox", type: "investment", color: "#2A2A6F", logo: L("moneybox", "png"), terms: ["moneybox"] },
  { key: "plum", name: "Plum", type: "investment", color: "#1C1C1C", logo: L("plum", "png"), terms: ["plum"] },
  { key: "st-jamess-place", name: "St. James’s Place", type: "investment", color: "#00263E", logo: L("st-jamess-place", "png"), terms: ["st jamess place", "st james's place", "st. james's place", "sjp"] },
  { key: "quilter", name: "Quilter", type: "investment", color: "#00474F", logo: L("quilter", "png"), terms: ["quilter", "old mutual wealth"] },
  { key: "schroders", name: "Schroders", type: "investment", color: "#002C5F", logo: L("schroders", "png"), terms: ["schroders"] },
  { key: "brewin-dolphin", name: "RBC Brewin Dolphin", type: "investment", color: "#002144", logo: L("brewin-dolphin", "png"), terms: ["brewin dolphin", "brewin"] },
  { key: "charles-stanley", name: "Charles Stanley", type: "investment", color: "#00205B", logo: L("charles-stanley", "png"), terms: ["charles stanley"] },
  { key: "wealthify", name: "Wealthify", type: "investment", color: "#3C1053", logo: L("wealthify", "png"), terms: ["wealthify"] },
  { key: "jupiter", name: "Jupiter", type: "investment", color: "#1A1446", logo: L("jupiter", "png"), terms: ["jupiter asset", "jupiter fund"] },
  // Pensions and life insurance
  { key: "aviva", name: "Aviva", type: "insurer", color: "#FFD900", logo: L("aviva", "png"), terms: ["aviva", "norwich union"] },
  { key: "legal-and-general", name: "Legal & General", type: "insurer", color: "#0077C8", logo: L("legal-and-general", "png"), terms: ["legal and general", "legal & general", "l&g", "landg"] },
  { key: "scottish-widows", name: "Scottish Widows", type: "pension", color: "#1D1D1B", logo: L("scottish-widows", "png"), terms: ["scottish widows"] },
  { key: "standard-life", name: "Standard Life", type: "pension", color: "#002F6C", logo: L("standard-life", "png"), terms: ["standard life"] },
  { key: "royal-london", name: "Royal London", type: "pension", color: "#5C2D91", logo: L("royal-london", "png"), terms: ["royal london"] },
  { key: "prudential", name: "Prudential", type: "pension", color: "#ED1B2E", logo: L("m-and-g", "png"), terms: ["prudential", "pru"] },
  { key: "m-and-g", name: "M&G", type: "pension", color: "#1D1D1B", logo: L("m-and-g", "png"), terms: ["m&g", "m and g", "mandg"] },
  { key: "phoenix", name: "Phoenix Life", type: "pension", color: "#E35205", logo: L("standard-life", "png"), terms: ["phoenix life", "phoenix"] },
  { key: "aegon", name: "Aegon", type: "pension", color: "#0B3B6E", logo: L("aegon", "png"), terms: ["aegon", "cofunds"] },
  { key: "canada-life", name: "Canada Life", type: "pension", color: "#DA291C", logo: L("canada-life", "png"), terms: ["canada life"] },
  { key: "nest", name: "Nest Pensions", type: "pension", color: "#E5007D", logo: L("nest", "png"), terms: ["nest pension", "nest pensions", "nest"] },
  { key: "peoples-pension", name: "The People’s Pension", type: "pension", color: "#5B2C83", logo: L("peoples-pension", "png"), terms: ["peoples pension", "people's pension"] },
  { key: "now-pensions", name: "NOW: Pensions", type: "pension", color: "#E4002B", logo: L("now-pensions", "png"), terms: ["now pensions", "now: pensions"] },
  { key: "pensionbee", name: "PensionBee", type: "pension", color: "#FFC400", logo: L("pensionbee", "png"), terms: ["pensionbee", "pension bee"] },
  { key: "just", name: "Just Group", type: "pension", color: "#00A3AD", logo: L("just", "png"), terms: ["just group", "just retirement"] },
  { key: "zurich", name: "Zurich", type: "insurer", color: "#2167AE", logo: L("zurich", "png"), terms: ["zurich"] },
  { key: "axa", name: "AXA", type: "insurer", color: "#00008F", logo: L("axa", "png"), terms: ["axa"] },
  { key: "allianz", name: "Allianz", type: "insurer", color: "#003781", logo: L("allianz", "png"), terms: ["allianz"] },
  { key: "lv", name: "LV=", type: "insurer", color: "#00A651", logo: L("lv", "png"), terms: ["lv=", "liverpool victoria", "lv"] },
  { key: "vitality", name: "Vitality", type: "insurer", color: "#E5007E", logo: L("vitality", "png"), terms: ["vitality"] },
  { key: "bupa", name: "Bupa", type: "insurer", color: "#0079C8", logo: L("bupa", "png"), terms: ["bupa"] },
  { key: "sun-life", name: "Sun Life", type: "insurer", color: "#FFB81C", logo: L("sun-life", "png"), terms: ["sun life"] },
  // General insurers
  { key: "direct-line", name: "Direct Line", type: "insurer", color: "#E30613", logo: L("direct-line", "png"), terms: ["direct line"] },
  { key: "admiral", name: "Admiral", type: "insurer", color: "#0E3B5E", logo: L("admiral", "png"), terms: ["admiral"] },
  { key: "churchill", name: "Churchill", type: "insurer", color: "#0A2D6E", logo: L("churchill", "png"), terms: ["churchill"] },
  { key: "hastings", name: "Hastings Direct", type: "insurer", color: "#0A2240", logo: L("hastings", "png"), terms: ["hastings direct", "hastings"] },
  { key: "esure", name: "esure", type: "insurer", color: "#E4003B", logo: L("esure", "png"), terms: ["esure"] },
  { key: "saga", name: "Saga", type: "insurer", color: "#003A70", logo: L("saga", "png"), terms: ["saga"] },
  { key: "nfu-mutual", name: "NFU Mutual", type: "insurer", color: "#00593F", terms: ["nfu mutual", "nfu"] },
  { key: "ageas", name: "Ageas", type: "insurer", color: "#0E4C92", logo: L("ageas", "png"), terms: ["ageas"] },
  { key: "rsa", name: "RSA / More Than", type: "insurer", color: "#2E1A47", logo: L("rsa", "png"), terms: ["rsa", "more than", "morethan"] },
  { key: "hiscox", name: "Hiscox", type: "insurer", color: "#C8102E", logo: L("hiscox", "png"), terms: ["hiscox"] },
  { key: "john-lewis-insurance", name: "John Lewis Finance", type: "insurer", color: "#1D1D1B", terms: ["john lewis money", "john lewis insurance", "john lewis finance"] },
  { key: "ecclesiastical", name: "Ecclesiastical", type: "insurer", color: "#5E2750", terms: ["ecclesiastical"] },
  { key: "simply-health", name: "Simplyhealth", type: "insurer", color: "#6CC24A", logo: L("simply-health", "png"), terms: ["simplyhealth", "simply health"] },
];

const TILE_PALETTE = ["#8C4A32", "#2F6B4F", "#2C4A7C", "#6B3F7A", "#9A6A16", "#3E6E77", "#7A2E3A", "#4A5568"];

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[’']/g, "").replace(/[^a-z0-9.=: ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Best match by whole words, longest term first ("Bank of Scotland" before "Scotland"). */
export function findProviderBrand(input) {
  const text = ` ${normalise(input)} `;
  if (!text.trim()) return null;
  let best = null;
  for (const brand of PROVIDER_BRANDS) {
    for (const raw of [brand.name, ...brand.terms]) {
      const term = normalise(raw);
      if (!term || term.length < 2) continue;
      // "Quilters" or "Barclays" typed loosely still match (plural or possessive s).
      if ((text.includes(` ${term} `) || text.includes(` ${term}s `)) && (!best || term.length > best.length)) best = { length: term.length, brand };
    }
  }
  return best?.brand ?? null;
}

/** A steady colour for any name not in the list, so the same firm always gets the same tile. */
export function tileColourFor(name) {
  let hash = 0;
  for (const char of normalise(name)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TILE_PALETTE[hash % TILE_PALETTE.length];
}

/** White or dark text, whichever reads better on the tile colour. */
export function tileTextColour(hex) {
  const value = String(hex ?? "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#1F1A17" : "#FFFFFF";
}

/** The first letter to show on a tile ("The People’s Pension" → P, "first direct" → F). */
export function tileLetter(name) {
  const words = String(name ?? "").replace(/^the\s+/i, "").trim().split(/\s+/);
  const letter = (words[0] ?? "").replace(/[^a-z0-9]/gi, "").charAt(0);
  return (letter || "?").toUpperCase();
}
