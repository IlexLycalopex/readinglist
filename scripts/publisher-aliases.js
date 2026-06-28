/**
 * Canonical publisher names. Open Library and Google Books return the
 * publisher of whichever edition matched, so the same imprint shows up in
 * many spellings ("Charco" / "Charco Press", "HARPERCOLLINS" / "Harper").
 *
 * canonicalPublisher() strips corporate suffixes, then maps known variants
 * (case-insensitively) to one canonical name. Distinct imprints (Vintage,
 * Del Rey, Hamish Hamilton…) are kept; corporate-level duplicates merge.
 * Values that aren't a real publisher map to null.
 */

const ALIASES = new Map(Object.entries({
  // Penguin / Random House corporate family
  'penguin': 'Penguin Random House',
  'penguin books': 'Penguin Random House',
  'penguin press': 'Penguin Random House',
  'penguin publishing group': 'Penguin Random House',
  'penguin group usa': 'Penguin Random House',
  'penguin random house audio': 'Penguin Random House',
  'random house': 'Penguin Random House',
  'random house.': 'Penguin Random House',
  'random house publishing group': 'Penguin Random House',
  'random house lcc us': 'Penguin Random House',
  'random house large print': 'Penguin Random House',
  'random house audio': 'Penguin Random House',

  // HarperCollins
  'harper': 'HarperCollins',
  'harpercollins': 'HarperCollins',
  'harpercollins publishers': 'HarperCollins',
  'harpercollins publishers and blackstone audio': 'HarperCollins',
  'harper paperbacks': 'HarperCollins',
  'harperperennial': 'HarperCollins',
  'harperluxe': 'HarperCollins',

  // Independents with spelling drift
  'charco': 'Charco Press',
  'fitzcarraldo': 'Fitzcarraldo Editions',
  'aberdeenuniversity press': 'Aberdeen University Press',
  'canongate': 'Canongate',
  'canongate books': 'Canongate',
  'bloomsbury publishing': 'Bloomsbury',
  'everyman publishers': 'Everyman',
  'faber and faber': 'Faber & Faber',
  'simon and schuster': 'Simon & Schuster',
  'w. w. norton & company': 'W. W. Norton',
  'norton & company limited, w. w.': 'W. W. Norton',
  'murray press, john': 'John Murray',
  'vintage books': 'Vintage',
  'vintage books usa': 'Vintage',
  'vintage (rand)': 'Vintage',
  'knopf doubleday publishing group': 'Knopf',
  'doubleday canada': 'Doubleday',
  'st. martin\'s griffin': "St. Martin's Press",
  'dark horse books': 'Dark Horse Comics',
  'tor.com': 'Tor',
  'paidos': 'Paidós',
  'blackstone audio': 'Blackstone Publishing',
  'little, brown book group': 'Little, Brown',
  'macmillan audio': 'Macmillan',
  'orion mass market paperback': 'Orion',
  'atlantic monthly pr': 'Atlantic Monthly Press',
  'turner publicaciones s.l.': 'Turner',
  'signet, new american library': 'Signet',
  'holt rinehart and winston (reinhart editions)': 'Holt, Rinehart and Winston',
  'basic books, a member of the perseus book group': 'Basic Books',
  'vertebrate graphics': 'Vertebrate Publishing',
  'northland pub': 'Northland Publishing',
  'center point pub': 'Center Point Publishing',

  // Not publishers: distributors, library binders, OL noise
  'generic': null,
  'book club': null,
  'imusti': null,
  'tandem library': null,
  'contemporary french fiction': null,
  'indypublish.com': null,
  'galaxy plus': null,
  'distribooks': null,
  'ye ren/tsai fong books': null,
  'qi ming chu ban shi ye gu fen you xian gong si': null,
}));

export function canonicalPublisher(name) {
  if (!name) return null;
  let clean = name.trim().replace(/\s+/g, ' ');
  // Strip trailing corporate suffixes: ", Limited", " Ltd.", ", LLC", " Inc."
  clean = clean.replace(/,?\s+(limited|ltd\.?|llc\.?|inc\.?)$/i, '');
  const mapped = ALIASES.get(clean.toLowerCase());
  if (mapped !== undefined) return mapped;
  return clean || null;
}
