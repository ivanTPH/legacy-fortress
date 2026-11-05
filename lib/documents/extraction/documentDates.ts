/**
 * Dates read from a document (owner decision 5 Nov 2026):
 * - a Will's signing date, so the "has anything changed?" check counts from when it was made;
 * - an identity document's expiry date, so we can say about 3 months before it runs out.
 * Suggestions only: the owner confirms before anything is saved. Text is never stored or logged.
 */
export type DocumentDateKind = "will_signed_on" | "renewal_date";
export type DocumentDateFinding = { kind: DocumentDateKind; date: string; page: number };

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_WORD = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, "twenty-first": 21, "twenty-second": 22, "twenty-third": 23, "twenty-fourth": 24, "twenty-fifth": 25,
  "twenty-sixth": 26, "twenty-seventh": 27, "twenty-eighth": 28, "twenty-ninth": 29, thirtieth: 30, "thirty-first": 31,
};

function iso(year: number, month: number, day: number) {
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

/** Every date in a piece of text, in order, with where it starts. UK order (day before month). */
export function findDates(text: string): Array<{ date: string; index: number }> {
  const found: Array<{ date: string; index: number }> = [];
  const add = (date: string | null, index: number) => { if (date && !found.some((item) => item.index === index)) found.push({ date, index }); };
  const patterns: Array<[RegExp, (m: RegExpExecArray) => string | null]> = [
    // 12 March 2014, 12th March 2014, 12th day of March 2014, 12 MAR /MARS 2031
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+day)?(?:\\s+of)?[\\s.-]+${MONTH_WORD}\\.?(?:\\s*\\/\\s*[a-zé]+\\.?)?[\\s,.-]+(\\d{4}|\\d{2})\\b`, "gi"),
      (m) => iso(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]))],
    // the twelfth day of March 2014
    [new RegExp(`\\b(${Object.keys(DAY_WORDS).join("|")})\\s+day\\s+of\\s+${MONTH_WORD}[\\s,]+(?:in the year\\s+)?(\\d{4})\\b`, "gi"),
      (m) => iso(Number(m[3]), MONTHS[m[2].toLowerCase()], DAY_WORDS[m[1].toLowerCase()])],
    // March 12, 2014
    [new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
      (m) => iso(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]))],
    // 2014-03-12
    [/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => iso(Number(m[1]), Number(m[2]), Number(m[3]))],
    // 12/03/2014, 12.03.2014, 12-03-14
    [/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g, (m) => iso(Number(m[3]), Number(m[2]), Number(m[1]))],
  ];
  for (const [pattern, toDate] of patterns) {
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) add(toDate(match), match.index);
  }
  return found.sort((a, b) => a.index - b.index);
}

const BIRTH = /\b(date of birth|d\.?o\.?b|born)\b/i;

/** The first date that follows one of the cues, within a short distance, skipping dates of birth. */
function dateAfterCue(text: string, cues: RegExp, reach: number) {
  const dates = findDates(text);
  const cueRe = new RegExp(cues.source, cues.flags.includes("g") ? cues.flags : `${cues.flags}g`);
  const hits: Array<{ date: string; index: number }> = [];
  for (let cue = cueRe.exec(text); cue; cue = cueRe.exec(text)) {
    const start = cue.index;
    const next = dates.find((item) => item.index >= start && item.index - start <= reach);
    if (!next) continue;
    const between = text.slice(start, next.index);
    if (BIRTH.test(between)) continue;
    hits.push(next);
  }
  return hits;
}

const WILL_CUES = /\b(dated|signed (?:by|on|this)|signed and dated|in witness whereof|this\s+[\w-]+\s+day of|date of (?:this )?will|date signed|executed on)\b/i;
const EXPIRY_CUES = /\b(date of expiry|expiry date|expiry|expires(?: on)?|valid until|valid to|4b\.?)\b/i;

/**
 * The Will's signing date. Wills are usually dated at the end ("Signed by the testator on…"),
 * so where several dates follow a signing cue we take the last one.
 */
export function findWillDate(pages: Array<{ page: number; text: string }>): DocumentDateFinding | null {
  let best: DocumentDateFinding | null = null;
  for (const page of pages) {
    const hits = dateAfterCue(page.text, WILL_CUES, 60);
    const last = hits[hits.length - 1];
    if (last) best = { kind: "will_signed_on", date: last.date, page: page.page };
  }
  return best;
}

/** An identity document's expiry date: the date after "Date of expiry", "Valid until" or the licence's 4b. */
export function findExpiryDate(pages: Array<{ page: number; text: string }>): DocumentDateFinding | null {
  for (const page of pages) {
    const hits = dateAfterCue(page.text, EXPIRY_CUES, 40);
    if (hits.length) {
      // On passports the expiry is the latest date on the page; prefer the latest cue match.
      const latest = hits.reduce((a, b) => (b.date > a.date ? b : a));
      return { kind: "renewal_date", date: latest.date, page: page.page };
    }
  }
  return null;
}

/** "12 March 2014" for display. */
export function formatDocumentDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
