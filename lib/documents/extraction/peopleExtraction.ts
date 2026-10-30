/**
 * Finds people named with a role in already-extracted document text (Wills, codicils,
 * powers of attorney, trust deeds, policies). Pure: no storage, persistence or network.
 * Every finding carries its page and the evidence line; the owner decides what happens.
 */
export type ExtractedPerson = { name: string; role: string; page: number; evidence: string };

type Page = { page: number; text: string };

const ROLE_WORDS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\b(?:substitute|reserve|alternative|alternate)\s+executors?\b/i, role: "Reserve executor" },
  { pattern: /\breplacement\s+attorneys?\b/i, role: "Replacement attorney" },
  { pattern: /\bexecutors?\b|\bexecutrix\b/i, role: "Executor" },
  { pattern: /\btrustees?\b/i, role: "Trustee" },
  { pattern: /\battorneys?\b/i, role: "Attorney" },
  { pattern: /\bguardians?\b/i, role: "Guardian" },
  { pattern: /\bbeneficiar(?:y|ies)\b/i, role: "Beneficiary" },
  { pattern: /\bsolicitors?\b/i, role: "Solicitor" },
];

// Labelled lines: "Executor: Jane Example", "Attorney 2: Robert Sample", "Replacement attorney - Mary".
const LABEL = /^(?:section\s*\d+\s*[:.-]?\s*)?((?:substitute|reserve|replacement|alternative)?\s*(?:executor|executrix|trustee|attorney|guardian|beneficiary|solicitor))s?\s*(?:\d+)?\s*[:–—-]\s*(.+)$/i;

const TITLE = /^(?:mr|mrs|ms|miss|mx|dr|prof|sir|dame|lady|lord|rev)\.?\s+/i;
const NAME_WORD = "(?:[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)*|Mc[A-Z][a-z]+|O'[A-Z][a-z]+)";
const NAME = new RegExp(`(?:(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Sir|Dame|Rev)\\.?\\s+)?${NAME_WORD}(?:\\s+${NAME_WORD}){1,3}`, "g");
const NOT_NAMES = new Set(["Last Will", "Will And", "Lasting Power", "Power Of", "Property And", "Financial Affairs", "Health And", "Section", "Statement", "Sample Street", "Example Road"]);
const RELATIONSHIP = /\b(?:my|our)\s+(?:wife|husband|partner|civil partner|spouse|son|sons|daughter|daughters|children|child|brother|brothers|sister|sisters|mother|father|parents|cousin|cousins|nephew|niece|grandson|granddaughter|grandchildren|friend|friends|solicitor|accountant)\b/gi;

export function extractNamedPeople(pages: Page[]): ExtractedPerson[] {
  const found: ExtractedPerson[] = [];
  for (const page of pages.slice(0, 30)) {
    const lines = normaliseOcr(page.text).split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    // 1. Labelled lines.
    for (const line of lines) {
      const match = line.match(LABEL);
      if (!match) continue;
      const role = roleFrom(match[1]);
      for (const name of namesIn(match[2]).slice(0, 4)) found.push({ name, role, page: page.page, evidence: line.slice(0, 240) });
    }
    // 2. Appointment sentences, which often wrap across lines.
    const text = lines.join(" ");
    for (const sentence of text.split(/(?<=[.;])\s+(?=[A-Z0-9])/)) {
      if (sentence.length > 600) continue;
      const appoint = sentence.match(/\b(?:appoint|appoints|nominate|name)\b([\s\S]+)/i);
      if (appoint) {
        const roleMatch = ROLE_WORDS.find((entry) => entry.pattern.test(appoint[1]));
        if (roleMatch) {
          const before = appoint[1].split(/\b(?:to be|as)\b/i)[0] ?? appoint[1];
          for (const name of namesIn(stripAddresses(before)).slice(0, 6)) found.push({ name, role: roleMatch.role, page: page.page, evidence: sentence.slice(0, 240) });
          // "I appoint X and Y to be the executors and trustees" also makes them trustees.
          if (roleMatch.role === "Executor" && /\band\s+trustees?\b/i.test(appoint[1])) {
            for (const name of namesIn(stripAddresses(before)).slice(0, 6)) found.push({ name, role: "Trustee", page: page.page, evidence: sentence.slice(0, 240) });
          }
          continue;
        }
      }
      const gift = sentence.match(/\b(?:I give|I leave|I bequeath|I devise)\b[\s\S]*?\bto\b([\s\S]+)/i);
      if (gift) {
        for (const name of namesIn(stripAddresses(gift[1])).slice(0, 6)) found.push({ name, role: "Beneficiary", page: page.page, evidence: sentence.slice(0, 240) });
      }
    }
  }
  return dedupe(found);
}

function normaliseOcr(text: string) {
  // OCR often reads a capital I at the start of a line as a vertical bar.
  return text.replace(/(^|\n)\s*[|!l]\s+(?=[a-z])/g, "$1I ").replace(/[‘’]/g, "'");
}

function roleFrom(label: string) {
  const text = label.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(?:substitute|reserve|alternative) executor/.test(text)) return "Reserve executor";
  if (/^replacement attorney/.test(text)) return "Replacement attorney";
  const entry = ROLE_WORDS.find((item) => item.pattern.test(text));
  return entry?.role ?? "Other";
}

function stripAddresses(text: string) {
  return text.replace(/\bof\s+\d+[^,;]*?(?=\band\b|,|;|$)/gi, " ").replace(RELATIONSHIP, " ");
}

function namesIn(text: string) {
  const names: string[] = [];
  for (const match of text.matchAll(NAME)) {
    const name = match[0].replace(TITLE, "").replace(/\s+/g, " ").trim();
    const words = name.split(" ");
    if (words.length < 2 || words.length > 4) continue;
    if (NOT_NAMES.has(words.slice(0, 2).join(" "))) continue;
    if (/\b(?:Will|Testament|Street|Road|Avenue|Lane|Close|Bank|Limited|Ltd|Plc|LLP|Trust|Estate|Section|Attorney|Executor|Trustee|Guardian)\b/.test(name)) continue;
    names.push(name);
  }
  return names;
}

function dedupe(items: ExtractedPerson[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name.toLowerCase()}|${item.role.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 25);
}
