/**
 * Well-known UK financial providers (owner decision 23 Nov 2026; widened to about 210 on 25 Nov 2026): a logo where the repository holds one, otherwise
 * a tile in the firm's own colour with its initial. Logos live under /logos/finance (repository-owned files; the
 * card and payment marks are CC0 glyphs from Simple Icons; 33 more came from Wikimedia Commons on 24 Nov 2026, public
 * domain or Creative Commons, credited in public/logos/finance/CREDITS.md and on the terms page; 34 more are the official app icons from the
 * providers' own websites, also 24 Nov 2026). Brand changes: Prudential (UK) shows M&G (Pru is part of M&G). Clydesdale keeps its own new logo (mortgages
 * still carry it) and Phoenix Life keeps its own (only the parent company became Standard Life plc). Colours are approximate brand colours, used only for the
 * tile. Anything not listed still gets a tile, in a steady colour picked from its name.
 */
const L = (key, ext = "svg") => `/logos/finance/${key}.${ext}`;
/** Official app icons from the providers' UK App Store listings (owner decision 25 Nov 2026). */
const A = (key) => `/logos/apps/${key}.png`;

export const PROVIDER_BRANDS = [
  // Banks and building societies
  { key: "barclays", name: "Barclays", type: "bank", color: "#00AEEF", logo: A("barclays"), terms: ["barclays", "barclaycard"] },
  { key: "hsbc", name: "HSBC", type: "bank", color: "#DB0011", logo: A("hsbc"), terms: ["hsbc"] },
  { key: "lloyds", name: "Lloyds", type: "bank", color: "#006A4D", logo: A("lloyds"), terms: ["lloyds", "lloyds bank", "lloyds tsb"] },
  { key: "natwest", name: "NatWest", type: "bank", color: "#42145F", logo: A("natwest"), terms: ["natwest", "nat west", "national westminster"] },
  { key: "rbs", name: "Royal Bank of Scotland", type: "bank", color: "#1D3D78", logo: A("rbs"), terms: ["rbs", "royal bank of scotland"] },
  { key: "nationwide", name: "Nationwide", type: "bank", color: "#00205B", logo: A("nationwide"), terms: ["nationwide"] },
  { key: "monzo", name: "Monzo", type: "bank", color: "#14233C", logo: A("monzo"), terms: ["monzo"] },
  { key: "starling", name: "Starling", type: "bank", color: "#3B2A55", logo: A("starling"), terms: ["starling"] },
  { key: "revolut", name: "Revolut", type: "bank", color: "#191C1F", logo: A("revolut"), terms: ["revolut"] },
  { key: "co-operative", name: "Co-operative Bank", type: "bank", color: "#00573F", logo: A("co-operative"), terms: ["co-operative bank", "co-op bank", "cooperative bank", "co operative bank"] },
  { key: "virgin-money", name: "Virgin Money", type: "bank", color: "#CC0000", logo: A("virgin-money"), terms: ["virgin money", "virgin"] },
  { key: "metro-bank", name: "Metro Bank", type: "bank", color: "#D6001C", logo: A("metro-bank"), terms: ["metro bank", "metrobank"] },
  { key: "chase", name: "Chase", type: "bank", color: "#117ACA", logo: A("chase"), terms: ["chase", "jp morgan chase", "jpmorgan"] },
  { key: "citibank", name: "Citibank", type: "bank", color: "#003B70", logo: L("citibank"), terms: ["citibank", "citi"] },
  { key: "deutsche-bank", name: "Deutsche Bank", type: "bank", color: "#0018A8", logo: A("deutsche-bank"), terms: ["deutsche bank", "deutsche"] },
  { key: "wise", name: "Wise", type: "bank", color: "#9FE870", logo: A("wise"), terms: ["wise", "transferwise"] },
  { key: "paypal", name: "PayPal", type: "bank", color: "#003087", logo: A("paypal"), terms: ["paypal"] },
  { key: "n26", name: "N26", type: "bank", color: "#48AC98", logo: A("n26"), terms: ["n26"] },
  { key: "bunq", name: "bunq", type: "bank", color: "#3394D7", logo: A("bunq"), terms: ["bunq"] },
  { key: "santander", name: "Santander", type: "bank", color: "#EC0000", logo: A("santander"), terms: ["santander", "abbey national"] },
  { key: "halifax", name: "Halifax", type: "bank", color: "#005EB8", logo: A("halifax"), terms: ["halifax"] },
  { key: "bank-of-scotland", name: "Bank of Scotland", type: "bank", color: "#003C71", logo: A("bank-of-scotland"), terms: ["bank of scotland"] },
  { key: "tsb", name: "TSB", type: "bank", color: "#1E4A9C", logo: A("tsb"), terms: ["tsb"] },
  { key: "first-direct", name: "first direct", type: "bank", color: "#000000", logo: A("first-direct"), terms: ["first direct", "firstdirect"] },
  { key: "ulster-bank", name: "Ulster Bank", type: "bank", color: "#1D3D78", logo: A("ulster-bank"), terms: ["ulster bank"] },
  { key: "bank-of-ireland", name: "Bank of Ireland", type: "bank", color: "#0033A0", logo: A("bank-of-ireland"), terms: ["bank of ireland"] },
  { key: "aib", name: "AIB", type: "bank", color: "#7F2B7B", logo: A("aib"), terms: ["aib", "allied irish"] },
  { key: "danske", name: "Danske Bank", type: "bank", color: "#003755", logo: A("danske"), terms: ["danske"] },
  { key: "tesco-bank", name: "Tesco Bank", type: "bank", color: "#00539F", logo: A("tesco-bank"), terms: ["tesco bank"] },
  { key: "sainsburys-bank", name: "Sainsbury’s Bank", type: "bank", color: "#F06C00", logo: A("sainsburys-bank"), terms: ["sainsburys bank", "sainsbury's bank"] },
  { key: "ms-bank", name: "M&S Bank", type: "bank", color: "#1F1F1F", logo: A("ms-bank"), terms: ["m&s bank", "m and s bank", "marks and spencer bank"] },
  { key: "atom", name: "Atom bank", type: "bank", color: "#3D2C8D", logo: A("atom"), terms: ["atom bank", "atom"] },
  { key: "zopa", name: "Zopa", type: "bank", color: "#1F2A44", logo: A("zopa"), terms: ["zopa"] },
  { key: "kroo", name: "Kroo", type: "bank", color: "#1E1E1E", logo: A("kroo"), terms: ["kroo"] },
  { key: "chip", name: "Chip", type: "bank", color: "#1F1A3D", logo: A("chip"), terms: ["chip"] },
  { key: "yorkshire-bs", name: "Yorkshire Building Society", type: "bank", color: "#00A4E4", logo: A("yorkshire-bs"), terms: ["yorkshire building society", "ybs"] },
  { key: "coventry-bs", name: "Coventry Building Society", type: "bank", color: "#0E2A50", logo: A("coventry-bs"), terms: ["coventry building society", "coventry bs"] },
  { key: "skipton-bs", name: "Skipton Building Society", type: "bank", color: "#003F7D", logo: A("skipton-bs"), terms: ["skipton"] },
  { key: "leeds-bs", name: "Leeds Building Society", type: "bank", color: "#00857C", logo: A("leeds-bs"), terms: ["leeds building society"] },
  { key: "post-office", name: "Post Office", type: "bank", color: "#DA291C", logo: A("post-office"), terms: ["post office money", "post office"] },
  { key: "ns-and-i", name: "NS&I", type: "bank", color: "#00205B", logo: A("ns-and-i"), terms: ["ns&i", "nsandi", "national savings", "premium bonds"] },
  { key: "triodos", name: "Triodos", type: "bank", color: "#00A19A", logo: A("triodos"), terms: ["triodos"] },
  { key: "coutts", name: "Coutts", type: "bank", color: "#1D2B4F", logo: A("coutts"), terms: ["coutts"] },
  { key: "clydesdale", name: "Clydesdale Bank", type: "bank", color: "#1D3D78", logo: L("clydesdale", "png"), terms: ["clydesdale"] },
  { key: "marcus", name: "Marcus by Goldman Sachs", type: "bank", color: "#181830", logo: A("marcus"), terms: ["marcus", "goldman sachs"] },
  { key: "investec", name: "Investec", type: "bank", color: "#787878", logo: A("investec"), terms: ["investec"] },
  { key: "close-brothers", name: "Close Brothers", type: "bank", color: null, terms: ["close brothers"] },
  { key: "shawbrook", name: "Shawbrook", type: "bank", color: "#C03078", logo: A("shawbrook"), terms: ["shawbrook"] },
  { key: "paragon", name: "Paragon Bank", type: "bank", color: null, terms: ["paragon bank"] },
  { key: "oaknorth", name: "OakNorth", type: "bank", color: "#186060", logo: A("oaknorth"), terms: ["oaknorth", "oak north"] },
  { key: "al-rayan", name: "Al Rayan Bank", type: "bank", color: "#3090A8", logo: A("al-rayan"), terms: ["al rayan"] },
  { key: "cynergy", name: "Cynergy Bank", type: "bank", color: "#48C0A8", logo: A("cynergy"), terms: ["cynergy"] },
  { key: "hampden", name: "Hampden & Co", type: "bank", color: "#301848", logo: A("hampden"), terms: ["hampden"] },
  { key: "arbuthnot", name: "Arbuthnot Latham", type: "bank", color: "#001848", logo: A("arbuthnot"), terms: ["arbuthnot"] },
  { key: "c-hoare", name: "C. Hoare & Co.", type: "bank", color: "#183030", logo: A("c-hoare"), terms: ["c hoare", "hoare and co", "hoares"] },
  { key: "handelsbanken", name: "Handelsbanken", type: "bank", color: "#184890", logo: A("handelsbanken"), terms: ["handelsbanken"] },
  { key: "allica", name: "Allica Bank", type: "bank", color: "#001848", logo: A("allica"), terms: ["allica"] },
  { key: "tide", name: "Tide", type: "bank", color: "#1818C0", logo: A("tide"), terms: ["tide"] },
  { key: "mettle", name: "Mettle", type: "bank", color: "#001818", logo: A("mettle"), terms: ["mettle"] },
  { key: "cater-allen", name: "Cater Allen", type: "bank", color: null, terms: ["cater allen"] },
  { key: "nottingham-bs", name: "Nottingham Building Society", type: "bank", color: "#60D890", logo: A("nottingham-bs"), terms: ["nottingham building society"] },
  { key: "principality", name: "Principality", type: "bank", color: null, terms: ["principality"] },
  { key: "west-brom", name: "West Brom Building Society", type: "bank", color: null, terms: ["west brom", "west bromwich building society"] },
  { key: "newcastle-bs", name: "Newcastle Building Society", type: "bank", color: "#487830", logo: A("newcastle-bs"), terms: ["newcastle building society"] },
  { key: "cumberland", name: "The Cumberland", type: "bank", color: "#184830", logo: A("cumberland"), terms: ["cumberland building society", "the cumberland"] },
  { key: "furness", name: "Furness Building Society", type: "bank", color: "#304818", logo: A("furness"), terms: ["furness building society"] },
  { key: "darlington-bs", name: "Darlington Building Society", type: "bank", color: null, terms: ["darlington building society"] },
  { key: "ecology", name: "Ecology Building Society", type: "bank", color: "#F0C030", logo: A("ecology"), terms: ["ecology building society"] },
  { key: "saffron", name: "Saffron Building Society", type: "bank", color: "#301848", logo: A("saffron"), terms: ["saffron building society"] },
  { key: "monmouthshire", name: "Monmouthshire Building Society", type: "bank", color: "#D87830", logo: A("monmouthshire"), terms: ["monmouthshire building society"] },
  { key: "progressive", name: "Progressive Building Society", type: "bank", color: null, terms: ["progressive building society"] },
  { key: "family-bs", name: "Family Building Society", type: "bank", color: null, terms: ["family building society"] },
  { key: "market-harborough", name: "Market Harborough Building Society", type: "bank", color: null, terms: ["market harborough building society"] },
  { key: "hinckley-rugby", name: "Hinckley & Rugby Building Society", type: "bank", color: "#484848", logo: A("hinckley-rugby"), terms: ["hinckley and rugby building society"] },
  { key: "melton-mowbray", name: "Melton Building Society", type: "bank", color: "#181848", logo: A("melton-mowbray"), terms: ["melton building society", "melton mowbray building society"] },
  { key: "vernon", name: "Vernon Building Society", type: "bank", color: null, terms: ["vernon building society"] },
  { key: "chorley", name: "Chorley Building Society", type: "bank", color: null, terms: ["chorley building society"] },
  { key: "beverley", name: "Beverley Building Society", type: "bank", color: null, terms: ["beverley building society"] },
  { key: "mansfield", name: "Mansfield Building Society", type: "bank", color: null, terms: ["mansfield building society"] },
  { key: "marsden", name: "Marsden Building Society", type: "bank", color: null, terms: ["marsden building society"] },
  { key: "loughborough", name: "Loughborough Building Society", type: "bank", color: null, terms: ["loughborough building society"] },
  { key: "swansea-bs", name: "Swansea Building Society", type: "bank", color: "#307830", logo: A("swansea-bs"), terms: ["swansea building society"] },
  { key: "teachers-bs", name: "Teachers Building Society", type: "bank", color: null, terms: ["teachers building society"] },
  { key: "dudley", name: "Dudley Building Society", type: "bank", color: null, terms: ["dudley building society"] },
  { key: "bath-bs", name: "Bath Building Society", type: "bank", color: "#A81830", logo: A("bath-bs"), terms: ["bath building society"] },
  { key: "buckinghamshire", name: "Buckinghamshire Building Society", type: "bank", color: null, terms: ["buckinghamshire building society"] },
  { key: "earl-shilton", name: "Earl Shilton Building Society", type: "bank", color: null, terms: ["earl shilton building society"] },
  { key: "harpenden", name: "Harpenden Building Society", type: "bank", color: null, terms: ["harpenden building society"] },
  { key: "penrith", name: "Penrith Building Society", type: "bank", color: null, terms: ["penrith building society"] },
  { key: "scottish-bs", name: "Scottish Building Society", type: "bank", color: "#1848A8", logo: A("scottish-bs"), terms: ["scottish building society"] },
  { key: "holmesdale", name: "Holmesdale Building Society", type: "bank", color: null, terms: ["holmesdale building society"] },
  { key: "tipton", name: "Tipton & Coseley Building Society", type: "bank", color: null, terms: ["tipton and coseley building society", "tipton building society"] },
  { key: "leek", name: "Leek Building Society", type: "bank", color: null, terms: ["leek building society", "leek united"] },
  { key: "stafford-railway", name: "Stafford Railway Building Society", type: "bank", color: null, terms: ["stafford railway building society"] },
  { key: "suffolk-bs", name: "Suffolk Building Society", type: "bank", color: null, terms: ["suffolk building society", "ipswich building society"] },
  { key: "newbury-bs", name: "Newbury Building Society", type: "bank", color: "#001830", logo: A("newbury-bs"), terms: ["newbury building society"] },
  { key: "cambridge-bs", name: "Cambridge Building Society", type: "bank", color: "#C03078", logo: A("cambridge-bs"), terms: ["cambridge building society"] },
  { key: "mbs", name: "Manchester Building Society", type: "bank", color: null, terms: ["manchester building society"] },
  { key: "hanley", name: "Hanley Economic Building Society", type: "bank", color: "#184890", logo: A("hanley"), terms: ["hanley economic"] },
  { key: "progressive-bs", name: "Progressive Building Society", type: "bank", color: "#D84830", logo: A("progressive-bs"), terms: ["progressive building society"] },
  // Cards and payments
  { key: "american-express", name: "American Express", type: "card", color: "#2E77BC", logo: A("american-express"), terms: ["american express", "amex"] },
  { key: "mastercard", name: "Mastercard", type: "card", color: "#EB001B", logo: L("mastercard"), terms: ["mastercard"] },
  { key: "visa", name: "Visa", type: "card", color: "#1A1F71", logo: L("visa"), terms: ["visa"] },
  { key: "klarna", name: "Klarna", type: "card", color: "#FFB3C7", logo: A("klarna"), terms: ["klarna"] },
  { key: "capital-one", name: "Capital One", type: "card", color: "#004879", logo: A("capital-one"), terms: ["capital one"] },
  { key: "mbna", name: "MBNA", type: "card", color: "#003C71", logo: A("mbna"), terms: ["mbna"] },
  { key: "barclaycard", name: "Barclaycard", type: "card", color: "#48A8D8", logo: A("barclaycard"), terms: ["barclaycard"] },
  { key: "vanquis", name: "Vanquis", type: "card", color: "#F0D8F0", logo: A("vanquis"), terms: ["vanquis"] },
  { key: "aqua", name: "Aqua", type: "card", color: "#60D8C0", logo: A("aqua"), terms: ["aqua card", "aqua credit card"] },
  { key: "newday", name: "NewDay", type: "card", color: null, terms: ["newday", "new day"] },
  { key: "jaja", name: "Jaja", type: "card", color: "#181818", logo: A("jaja"), terms: ["jaja"] },
  { key: "tymit", name: "Tymit", type: "card", color: null, terms: ["tymit"] },
  { key: "zable", name: "Zable", type: "card", color: "#181830", logo: A("zable"), terms: ["zable", "lendable"] },
  { key: "curve", name: "Curve", type: "card", color: "#181818", logo: A("curve"), terms: ["curve card", "curve pay"] },
  { key: "clearpay", name: "Clearpay", type: "card", color: "#C0F0D8", logo: A("clearpay"), terms: ["clearpay"] },
  { key: "premium-credit", name: "Premium Credit", type: "card", color: null, terms: ["premium credit"] },
  { key: "student-loans", name: "Student Loans Company", type: "card", color: null, terms: ["student loans company", "student loan"] },
  // Investments, platforms and crypto
  { key: "coinbase", name: "Coinbase", type: "investment", color: "#0052FF", logo: A("coinbase"), terms: ["coinbase"] },
  { key: "binance", name: "Binance", type: "investment", color: "#F0B90B", logo: A("binance"), terms: ["binance"] },
  { key: "hargreaves-lansdown", name: "Hargreaves Lansdown", type: "investment", color: "#0A2F5C", logo: A("hargreaves-lansdown"), terms: ["hargreaves lansdown", "hargreaves", "hl"] },
  { key: "aj-bell", name: "AJ Bell", type: "investment", color: "#E8471C", logo: A("aj-bell"), terms: ["aj bell", "ajbell", "youinvest"] },
  { key: "interactive-investor", name: "interactive investor", type: "investment", color: "#4B1E78", logo: A("interactive-investor"), terms: ["interactive investor", "ii.co.uk"] },
  { key: "vanguard", name: "Vanguard", type: "investment", color: "#96151D", logo: A("vanguard"), terms: ["vanguard"] },
  { key: "fidelity", name: "Fidelity", type: "investment", color: "#368727", logo: A("fidelity"), terms: ["fidelity"] },
  { key: "trading-212", name: "Trading 212", type: "investment", color: "#0090FF", logo: A("trading-212"), terms: ["trading 212", "trading212"] },
  { key: "freetrade", name: "Freetrade", type: "investment", color: "#1F2332", logo: A("freetrade"), terms: ["freetrade"] },
  { key: "etoro", name: "eToro", type: "investment", color: "#13C636", logo: A("etoro"), terms: ["etoro"] },
  { key: "nutmeg", name: "Nutmeg", type: "investment", color: "#1C1C3A", logo: A("nutmeg"), terms: ["nutmeg"] },
  { key: "moneybox", name: "Moneybox", type: "investment", color: "#2A2A6F", logo: A("moneybox"), terms: ["moneybox"] },
  { key: "plum", name: "Plum", type: "investment", color: "#1C1C1C", logo: A("plum"), terms: ["plum"] },
  { key: "st-jamess-place", name: "St. James’s Place", type: "investment", color: "#00263E", logo: A("st-jamess-place"), terms: ["st jamess place", "st james's place", "st. james's place", "sjp"] },
  { key: "quilter", name: "Quilter", type: "investment", color: "#00474F", logo: A("quilter"), terms: ["quilter", "old mutual wealth"] },
  { key: "schroders", name: "Schroders", type: "investment", color: "#002C5F", logo: A("schroders"), terms: ["schroders"] },
  { key: "brewin-dolphin", name: "RBC Brewin Dolphin", type: "investment", color: "#002144", logo: A("brewin-dolphin"), terms: ["brewin dolphin", "brewin"] },
  { key: "charles-stanley", name: "Charles Stanley", type: "investment", color: "#00205B", logo: A("charles-stanley"), terms: ["charles stanley"] },
  { key: "wealthify", name: "Wealthify", type: "investment", color: "#3C1053", logo: A("wealthify"), terms: ["wealthify"] },
  { key: "jupiter", name: "Jupiter", type: "investment", color: "#1A1446", logo: L("jupiter", "png"), terms: ["jupiter asset", "jupiter fund"] },
  { key: "kraken", name: "Kraken", type: "investment", color: "#6030D8", logo: A("kraken"), terms: ["kraken"] },
  { key: "crypto-com", name: "Crypto.com", type: "investment", color: "#000048", logo: A("crypto-com"), terms: ["crypto.com", "crypto com"] },
  { key: "gemini", name: "Gemini", type: "investment", color: "#D84818", logo: A("gemini"), terms: ["gemini exchange"] },
  { key: "jp-morgan-investing", name: "J.P. Morgan Personal Investing", type: "investment", color: "#301800", logo: A("jp-morgan-investing"), terms: ["jp morgan personal investing", "j.p. morgan personal investing"] },
  { key: "moneyfarm", name: "Moneyfarm", type: "investment", color: "#D83048", logo: A("moneyfarm"), terms: ["moneyfarm"] },
  { key: "ig", name: "IG", type: "investment", color: "#C03018", logo: A("ig"), terms: ["ig index", "ig markets", "ig trading"] },
  { key: "interactive-brokers", name: "Interactive Brokers", type: "investment", color: "#000000", logo: A("interactive-brokers"), terms: ["interactive brokers"] },
  { key: "saxo", name: "Saxo", type: "investment", color: "#A8A8C0", logo: A("saxo"), terms: ["saxo"] },
  { key: "plus500", name: "Plus500", type: "investment", color: "#001878", logo: A("plus500"), terms: ["plus500"] },
  { key: "cmc-markets", name: "CMC Markets", type: "investment", color: "#3060F0", logo: A("cmc-markets"), terms: ["cmc markets", "cmc invest"] },
  { key: "lightyear", name: "Lightyear", type: "investment", color: "#D8D8D8", logo: A("lightyear"), terms: ["lightyear"] },
  { key: "investengine", name: "InvestEngine", type: "investment", color: "#3030D8", logo: A("investengine"), terms: ["investengine", "invest engine"] },
  { key: "dodl", name: "Dodl", type: "investment", color: "#F0F0D8", logo: A("dodl"), terms: ["dodl"] },
  { key: "bestinvest", name: "Bestinvest", type: "investment", color: "#6000A8", logo: A("bestinvest"), terms: ["bestinvest"] },
  { key: "evelyn", name: "Evelyn Partners", type: "investment", color: "#481860", logo: A("evelyn"), terms: ["evelyn partners", "tilney", "smith and williamson"] },
  { key: "rathbones", name: "Rathbones", type: "investment", color: "#001848", logo: A("rathbones"), terms: ["rathbones", "investec wealth"] },
  { key: "brooks-macdonald", name: "Brooks Macdonald", type: "investment", color: "#000000", logo: A("brooks-macdonald"), terms: ["brooks macdonald"] },
  { key: "seven-im", name: "7IM", type: "investment", color: null, terms: ["7im", "seven investment management"] },
  { key: "true-potential", name: "True Potential", type: "investment", color: "#301848", logo: A("true-potential"), terms: ["true potential"] },
  { key: "robinhood", name: "Robinhood", type: "investment", color: "#C0F048", logo: A("robinhood"), terms: ["robinhood"] },
  // Pensions and life insurance
  { key: "aviva", name: "Aviva", type: "insurer", color: "#FFD900", logo: A("aviva"), terms: ["aviva", "norwich union"] },
  { key: "legal-and-general", name: "Legal & General", type: "insurer", color: "#0077C8", logo: A("legal-and-general"), terms: ["legal and general", "legal & general", "l&g", "landg"] },
  { key: "scottish-widows", name: "Scottish Widows", type: "pension", color: "#1D1D1B", logo: A("scottish-widows"), terms: ["scottish widows"] },
  { key: "standard-life", name: "Standard Life", type: "pension", color: "#002F6C", logo: A("standard-life"), terms: ["standard life"] },
  { key: "royal-london", name: "Royal London", type: "pension", color: "#5C2D91", logo: A("royal-london"), terms: ["royal london"] },
  { key: "prudential", name: "Prudential", type: "pension", color: "#ED1B2E", logo: L("m-and-g", "png"), terms: ["prudential", "pru"] },
  { key: "m-and-g", name: "M&G", type: "pension", color: "#1D1D1B", logo: L("m-and-g", "png"), terms: ["m&g", "m and g", "mandg"] },
  { key: "phoenix", name: "Phoenix Life", type: "pension", color: "#E35205", logo: A("phoenix"), terms: ["phoenix life", "phoenix"] },
  { key: "aegon", name: "Aegon", type: "pension", color: "#0B3B6E", logo: A("aegon"), terms: ["aegon", "cofunds"] },
  { key: "canada-life", name: "Canada Life", type: "pension", color: "#DA291C", logo: L("canada-life", "png"), terms: ["canada life"] },
  { key: "nest", name: "Nest Pensions", type: "pension", color: "#E5007D", logo: A("nest"), terms: ["nest pension", "nest pensions", "nest"] },
  { key: "peoples-pension", name: "The People’s Pension", type: "pension", color: "#5B2C83", logo: A("peoples-pension"), terms: ["peoples pension", "people's pension"] },
  { key: "now-pensions", name: "NOW: Pensions", type: "pension", color: "#E4002B", logo: A("now-pensions"), terms: ["now pensions", "now: pensions"] },
  { key: "pensionbee", name: "PensionBee", type: "pension", color: "#FFC400", logo: A("pensionbee"), terms: ["pensionbee", "pension bee"] },
  { key: "just", name: "Just Group", type: "pension", color: "#00A3AD", logo: L("just", "png"), terms: ["just group", "just retirement"] },
  { key: "zurich", name: "Zurich", type: "insurer", color: "#2167AE", logo: L("zurich", "png"), terms: ["zurich"] },
  { key: "axa", name: "AXA", type: "insurer", color: "#00008F", logo: L("axa", "png"), terms: ["axa"] },
  { key: "allianz", name: "Allianz", type: "insurer", color: "#003781", logo: L("allianz", "png"), terms: ["allianz"] },
  { key: "lv", name: "LV=", type: "insurer", color: "#00A651", logo: L("lv", "png"), terms: ["lv=", "liverpool victoria", "lv"] },
  { key: "vitality", name: "Vitality", type: "insurer", color: "#E5007E", logo: A("vitality"), terms: ["vitality"] },
  { key: "bupa", name: "Bupa", type: "insurer", color: "#0079C8", logo: A("bupa"), terms: ["bupa"] },
  { key: "sun-life", name: "Sun Life", type: "insurer", color: "#FFB81C", logo: L("sun-life", "png"), terms: ["sun life"] },
  { key: "smart-pension", name: "Smart Pension", type: "pension", color: "#183048", logo: A("smart-pension"), terms: ["smart pension"] },
  { key: "penfold", name: "Penfold", type: "pension", color: "#000030", logo: A("penfold"), terms: ["penfold"] },
  { key: "cushon", name: "Cushon", type: "pension", color: "#300060", logo: A("cushon"), terms: ["cushon"] },
  // General insurers
  { key: "direct-line", name: "Direct Line", type: "insurer", color: "#E30613", logo: A("direct-line"), terms: ["direct line"] },
  { key: "admiral", name: "Admiral", type: "insurer", color: "#0E3B5E", logo: A("admiral"), terms: ["admiral"] },
  { key: "churchill", name: "Churchill", type: "insurer", color: "#0A2D6E", logo: A("churchill"), terms: ["churchill"] },
  { key: "hastings", name: "Hastings Direct", type: "insurer", color: "#0A2240", logo: A("hastings"), terms: ["hastings direct", "hastings"] },
  { key: "esure", name: "esure", type: "insurer", color: "#E4003B", logo: A("esure"), terms: ["esure"] },
  { key: "saga", name: "Saga", type: "insurer", color: "#003A70", logo: L("saga", "png"), terms: ["saga"] },
  { key: "nfu-mutual", name: "NFU Mutual", type: "insurer", color: "#00593F", terms: ["nfu mutual", "nfu"] },
  { key: "ageas", name: "Ageas", type: "insurer", color: "#0E4C92", logo: L("ageas", "png"), terms: ["ageas"] },
  { key: "rsa", name: "RSA / More Than", type: "insurer", color: "#2E1A47", logo: L("rsa", "png"), terms: ["rsa", "more than", "morethan"] },
  { key: "hiscox", name: "Hiscox", type: "insurer", color: "#C8102E", logo: L("hiscox", "png"), terms: ["hiscox"] },
  { key: "john-lewis-insurance", name: "John Lewis Finance", type: "insurer", color: "#1D1D1B", logo: A("john-lewis-insurance"), terms: ["john lewis money", "john lewis insurance", "john lewis finance"] },
  { key: "ecclesiastical", name: "Ecclesiastical", type: "insurer", color: "#5E2750", terms: ["ecclesiastical"] },
  { key: "simply-health", name: "Simplyhealth", type: "insurer", color: "#6CC24A", logo: A("simply-health"), terms: ["simplyhealth", "simply health"] },
  { key: "aa", name: "AA", type: "insurer", color: "#F0C048", logo: A("aa"), terms: ["the aa", "aa insurance", "automobile association"] },
  { key: "rac", name: "RAC", type: "insurer", color: "#D84818", logo: A("rac"), terms: ["rac"] },
  { key: "green-flag", name: "Green Flag", type: "insurer", color: "#181818", logo: A("green-flag"), terms: ["green flag"] },
  { key: "swinton", name: "Swinton", type: "insurer", color: null, terms: ["swinton"] },
  { key: "sheilas-wheels", name: "Sheilas' Wheels", type: "insurer", color: "#D84890", logo: A("sheilas-wheels"), terms: ["sheilas wheels", "sheila's wheels"] },
  { key: "privilege", name: "Privilege", type: "insurer", color: null, terms: ["privilege insurance"] },
  { key: "first-central", name: "1st Central", type: "insurer", color: null, terms: ["1st central", "first central"] },
  { key: "co-op-insurance", name: "Co-op Insurance", type: "insurer", color: "#00A1CC", logo: A("co-op-insurance"), terms: ["co-op insurance", "co operative insurance"] },
  { key: "quote-me-happy", name: "Quote Me Happy", type: "insurer", color: "#A8D848", logo: A("quote-me-happy"), terms: ["quote me happy"] },
  { key: "by-miles", name: "By Miles", type: "insurer", color: "#D86048", logo: A("by-miles"), terms: ["by miles"] },
  { key: "cuvva", name: "Cuvva", type: "insurer", color: "#6030D8", logo: A("cuvva"), terms: ["cuvva"] },
  { key: "zego", name: "Zego", type: "insurer", color: "#301878", logo: A("zego"), terms: ["zego"] },
  { key: "lemonade", name: "Lemonade", type: "insurer", color: "#D81848", logo: A("lemonade"), terms: ["lemonade insurance"] },
  { key: "petplan", name: "Petplan", type: "insurer", color: null, terms: ["petplan", "pet plan"] },
  { key: "axa-health", name: "AXA Health", type: "insurer", color: "#000078", logo: A("axa-health"), terms: ["axa health", "axa ppp"] },
  { key: "wpa", name: "WPA", type: "insurer", color: "#183090", logo: A("wpa"), terms: ["wpa"] },
  { key: "guardian", name: "Guardian Financial Services", type: "insurer", color: null, terms: ["guardian financial", "guardian protection"] },
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

/**
 * Brand changes (owner decision 24 Nov 2026): a short note so whoever deals with the estate knows who to contact now.
 * Checked against the providers' own sites on 24 Nov 2026. Shown small at the bottom of a record and larger in the
 * printed executor pack.
 */
export const BRAND_CHANGES = {
  halifax: "Halifax is now Lloyds. Account numbers, sort codes and policy numbers stay the same: contact Lloyds.",
  prudential: "Pru (Prudential UK) is part of M&G: contact M&G about this.",
  clydesdale: "Clydesdale is now part of Nationwide. Account details stay the same.",
  "virgin-money": "Virgin Money is now part of Nationwide. Account details stay the same.",
  phoenix: "Phoenix Life is part of Standard Life plc. Policies are unchanged: contact Phoenix Life.",
  "brewin-dolphin": "Brewin Dolphin is now RBC Brewin Dolphin (RBC Wealth Management).",
  "john-lewis-insurance": "John Lewis Finance is now John Lewis Money.",
  nutmeg: "Nutmeg is now J.P. Morgan Personal Investing.",
};

/** The brand-change note for a provider name, or null. */
export function brandChangeNote(input) {
  const brand = findProviderBrand(input);
  return brand ? BRAND_CHANGES[brand.key] ?? null : null;
}
