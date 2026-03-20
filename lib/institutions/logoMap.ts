export type InstitutionBrand = {
  key: string;
  displayName: string;
  logoPath: string;
  aliases: string[];
};

const KNOWN_INSTITUTIONS: InstitutionBrand[] = [
  {
    key: "hsbc",
    displayName: "HSBC",
    logoPath: "/institutions/hsbc.png",
    aliases: [
      "hsbc",
      "hsbc uk",
      "hongkong and shanghai banking corporation",
      "hong kong and shanghai banking corporation",
      "hsbc holdings",
    ],
  },
  {
    key: "barclays",
    displayName: "Barclays",
    logoPath: "/institutions/barclays.webp",
    aliases: ["barclays", "barclays bank", "barclays uk", "barclays plc"],
  },
  {
    key: "lloyds",
    displayName: "Lloyds",
    logoPath: "/institutions/lloyds.png",
    aliases: ["lloyds", "lloyds bank", "lloyds banking group"],
  },
];

export function resolveInstitutionBrand(input: string | null | undefined): InstitutionBrand | null {
  const normalized = normalizeInstitution(input);
  if (!normalized) return null;

  let best: { score: number; brand: InstitutionBrand } | null = null;
  for (const brand of KNOWN_INSTITUTIONS) {
    for (const alias of brand.aliases) {
      if (!alias) continue;
      if (normalized === alias) {
        const score = alias.length;
        if (!best || score > best.score) best = { score, brand };
      }
    }
  }
  return best?.brand ?? null;
}

function normalizeInstitution(input: string | null | undefined) {
  return `${input ?? ""}`
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_\s]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(bank|plc|limited|ltd|group|holdings|uk)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
