export type KeyFact = {
  id: string;
  stat: string;
  context: string;
  sourceName: string;
  sourceUrl: string;
  sourceDate: string;
};

export const LANDING_COPY = {
  heroTitle: "Legacy Fortress keeps life’s critical records ready when your family needs them most.",
  heroSubtitle:
    "A secure UK-focused estate and executor vault for documents, assets, wishes, and trusted contacts.",
  problem:
    "Families often struggle to locate wills, pensions, accounts, and practical instructions during illness, incapacity, or bereavement. Legacy Fortress reduces delay, confusion, and avoidable stress by keeping records organized in one secure place.",
  whatIs:
    "Legacy Fortress is a structured digital legacy workspace. Capture what exists, where it is, who needs access, and what should happen next.",
  benefits: [
    "One secure place for legal, financial, property, business, personal, and digital records",
    "Faster executor and adviser coordination when time matters",
    "Clear wishes and practical instructions for trusted contacts",
    "Reduced administrative burden during emotionally difficult periods",
  ],
  audiences: [
    "Individuals and couples planning ahead",
    "Families supporting ageing parents",
    "People with multiple assets, accounts, or properties",
    "Business owners and professionals with complex estates",
    "Executors, attorneys, and trusted advisers",
  ],
};

export const LANDING_KEY_FACTS: KeyFact[] = [
  {
    id: "lost-pensions",
    stat: "£31.1 billion",
    context:
      "estimated value of lost UK pension pots across around 3.3 million pots, increasing estate complexity when records are missing.",
    sourceName: "Pensions Policy Institute (PPI) - Lost Pensions 2024",
    sourceUrl: "https://www.ppi.org.uk/policy-research/lost-pensions-2024",
    sourceDate: "June 2024",
  },
  {
    id: "no-will",
    stat: "56% of UK adults",
    context:
      "reportedly do not have a will, increasing the likelihood of avoidable legal and administrative difficulties.",
    sourceName: "Money and Pensions Service - UK Strategy for Financial Wellbeing",
    sourceUrl: "https://maps.org.uk/en/publications/uk-strategy-for-financial-wellbeing-progress-report-2024",
    sourceDate: "2024",
  },
  {
    id: "dormant-assets",
    stat: "£2+ billion",
    context:
      "has been transferred from dormant accounts to social/environmental causes via the UK Dormant Assets Scheme, showing the scale of unclaimed financial value.",
    sourceName: "Reclaim Fund Ltd - Dormant Assets Scheme reporting",
    sourceUrl: "https://www.reclaimfund.co.uk/about/dormant-assets-scheme",
    sourceDate: "2024",
  },
];
