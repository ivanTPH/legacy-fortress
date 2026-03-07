export type BankProviderKey =
  | "hsbc"
  | "barclays"
  | "lloyds"
  | "natwest"
  | "santander"
  | "nationwide"
  | "revolut"
  | "monzo"
  | "starling"
  | "default";

export type BankDetectionInput = {
  bank_name?: string | null;
  provider?: string | null;
  institution?: string | null;
  sort_code?: string | null;
  account_provider?: string | null;
  bank_identifier?: string | null;
};

export const bankLogos: Record<BankProviderKey, string> = {
  hsbc: "/logos/banks/hsbc.svg",
  barclays: "/logos/banks/barclays.svg",
  lloyds: "/logos/banks/lloyds.svg",
  natwest: "/logos/banks/natwest.svg",
  santander: "/logos/banks/santander.svg",
  nationwide: "/logos/banks/nationwide.svg",
  revolut: "/logos/banks/revolut.svg",
  monzo: "/logos/banks/monzo.svg",
  starling: "/logos/banks/starling.svg",
  default: "/icons/bank-default.svg",
};

const NOISE_WORDS = [
  "bank",
  "uk",
  "plc",
  "limited",
  "ltd",
  "group",
  "the",
  "co",
  "company",
];

const providerMatchers: Array<{ key: Exclude<BankProviderKey, "default">; patterns: string[] }> = [
  { key: "hsbc", patterns: ["hsbc", "hongkongshanghai"] },
  { key: "barclays", patterns: ["barclays"] },
  { key: "lloyds", patterns: ["lloyds", "lloydsbank"] },
  { key: "natwest", patterns: ["natwest", "nationalwestminster"] },
  { key: "santander", patterns: ["santander", "abbeynational"] },
  { key: "nationwide", patterns: ["nationwide", "nationwidebs", "nationwidebuildingsociety"] },
  { key: "revolut", patterns: ["revolut"] },
  { key: "monzo", patterns: ["monzo"] },
  { key: "starling", patterns: ["starling"] },
];

function sanitizeInput(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function normalizeBankName(value: string) {
  const safe = sanitizeInput(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!safe) return "";

  const words = safe
    .split(" ")
    .filter(Boolean)
    .filter((word) => !NOISE_WORDS.includes(word));

  return words.join("");
}

export function resolveBankProviderKey(input: string | BankDetectionInput): BankProviderKey {
  const values =
    typeof input === "string"
      ? [input]
      : [
          input.bank_name,
          input.provider,
          input.institution,
          input.account_provider,
          input.bank_identifier,
          input.sort_code,
        ];

  for (const raw of values) {
    if (!raw) continue;
    const normalized = normalizeBankName(raw);
    if (!normalized) continue;

    const directMatch = providerMatchers.find((item) =>
      item.patterns.some((pattern) => normalized.includes(pattern)),
    );
    if (directMatch) return directMatch.key;
  }

  return "default";
}

export function getBankLogo(bankName: string): string {
  return bankLogos[resolveBankProviderKey(bankName)];
}

export function getBankLogoFromRecord(input: BankDetectionInput) {
  const providerKey = resolveBankProviderKey(input);
  const logoSrc = bankLogos[providerKey];
  const bankLabel =
    input.bank_name || input.provider || input.institution || input.account_provider || input.bank_identifier;

  return {
    logoSrc,
    providerKey,
    alt: providerKey === "default" ? "Bank icon" : `${readableBankName(providerKey)} Bank logo`,
    bankLabel: bankLabel?.trim() || "Unknown Bank",
  };
}

function readableBankName(providerKey: Exclude<BankProviderKey, "default">) {
  switch (providerKey) {
    case "hsbc":
      return "HSBC";
    case "barclays":
      return "Barclays";
    case "lloyds":
      return "Lloyds";
    case "natwest":
      return "NatWest";
    case "santander":
      return "Santander";
    case "nationwide":
      return "Nationwide";
    case "revolut":
      return "Revolut";
    case "monzo":
      return "Monzo";
    case "starling":
      return "Starling";
  }
}
