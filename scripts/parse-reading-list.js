#!/usr/bin/env node
/**
 * Parses raw reading list text into structured YAML.
 *
 * Input format variations handled:
 *   Title - Author (pages) (DD/MM/YYYY - DD/MM/YYYY)
 *   Title - Author (pages) (DD/MM/YY - DD/MM/YY)
 *   Title - Author 👂
 *   Title - Author (pages) (DD/MM/YYYY-???????)
 *   Title - Author (?? - DD/MM/YYYY)
 *   Title - Author ()
 *
 * Format detection:
 *   👂 → audio, 🃏 → graphic, 📖 or none → print
 *
 * Usage:
 *   node scripts/parse-reading-list.js --year 2025 --input data-raw/2025.txt --output src/data/books/2025.yaml
 */

import { readFileSync, writeFileSync } from 'fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  return {
    year: get('--year'),
    input: get('--input'),
    output: get('--output'),
  };
}

function detectFormat(line) {
  if (line.includes('👂')) return 'audio';
  if (line.includes('🃏')) return 'graphic';
  return 'print';
}

function parseDateStr(s) {
  if (!s || /\?/.test(s)) return null;
  s = s.trim();
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function extractDates(line) {
  // Match last (...) that looks like a date range or single date
  const dateRangeRe = /\(([^)]*\d{2}[/\-]\d{2}[/\-]\d{2,4}[^)]*)\)/g;
  let lastMatch = null;
  let m;
  while ((m = dateRangeRe.exec(line)) !== null) lastMatch = m[1];
  if (!lastMatch) return { started: null, finished: null };

  const parts = lastMatch.split(/\s*-\s*/);
  if (parts.length === 2) {
    return { started: parseDateStr(parts[0]), finished: parseDateStr(parts[1]) };
  }
  // Single date — treat as finished
  return { started: null, finished: parseDateStr(parts[0]) };
}

function extractPages(segment) {
  const m = segment.match(/^\s*(\d+)\s*$/);
  return m ? parseInt(m[1]) : null;
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseLine(raw, order) {
  let line = raw.trim();

  // Strip list marker
  line = line.replace(/^\d+\.\s*/, '');
  // Strip Obsidian wikilink markup
  line = line.replace(/\[\[|\]\]/g, '');

  const format = detectFormat(line);

  // Strip emoji and markers for further parsing
  const clean = line
    .replace(/📖|👂|🃏|🔥|❣️|😍|✖️|❤️/gu, '')
    .replace(/\(Incomplete[^)]*\)/gi, '')
    .trim();

  // Try: Title - Author (pages) (dates)
  // Split on last ' - ' before parens
  const dashIdx = clean.lastIndexOf(' - ');
  let title = '';
  let author = '';
  let pages = null;

  if (dashIdx !== -1) {
    title = clean.slice(0, dashIdx).trim();
    let rest = clean.slice(dashIdx + 3).trim();
    // Extract parens groups
    const parens = [];
    const parenRe = /\(([^)]*)\)/g;
    let pm;
    while ((pm = parenRe.exec(rest)) !== null) parens.push(pm[1]);

    // First numeric paren = pages
    for (const p of parens) {
      const pg = extractPages(p);
      if (pg !== null) { pages = pg; break; }
    }

    // Author is everything before the first paren
    author = rest.replace(/\s*\(.*/, '').trim();
  } else {
    title = clean;
  }

  const { started, finished } = extractDates(clean);

  const incomplete = raw.includes('Incomplete');
  const notes = [
    raw.includes('🔥') ? '🔥' : '',
    raw.includes('❣️') ? '❣️' : '',
    raw.includes('😍') ? '😍' : '',
    raw.includes('✖️') ? 'Did not finish.' : '',
    incomplete ? 'Incomplete — carried forward.' : '',
  ].filter(Boolean).join(' ') || null;

  const ambiguous = !title || !author;
  if (ambiguous) {
    console.warn(`  [AMBIGUOUS] Line ${order}: "${raw.slice(0, 80)}"`);
  }

  return {
    needs_review: ambiguous || undefined,
    order,
    title,
    author,
    pages,
    date_started: started,
    date_finished: finished,
    format,
    year_published: null,
    genre: null,
    publisher: null,
    cover_url: '',
    isbn: '',
    description: '',
    tags: [],
    notes,
    links: { openlibrary: '', wikipedia: '' },
  };
}

function toYaml(year, books) {
  const bookLines = books.map((b) => {
    const lines = [
      `  - order: ${b.order}`,
      `    title: ${JSON.stringify(b.title)}`,
      `    author: ${JSON.stringify(b.author)}`,
      `    pages: ${b.pages ?? 'null'}`,
      `    date_started: ${b.date_started ? JSON.stringify(b.date_started) : 'null'}`,
      `    date_finished: ${b.date_finished ? JSON.stringify(b.date_finished) : 'null'}`,
      `    format: ${b.format}`,
      `    year_published: null`,
      `    genre: null`,
      `    publisher: null`,
      `    cover_url: ""`,
      `    isbn: ""`,
      `    description: ""`,
      `    tags: []`,
      `    notes: ${b.notes ? JSON.stringify(b.notes) : '""'}`,
      `    links:`,
      `      openlibrary: ""`,
      `      wikipedia: ""`,
    ];
    if (b.needs_review) lines.unshift('    needs_review: true');
    return lines.join('\n');
  });

  return `year: ${year}\ntotal_books: ${books.length}\n\nbooks:\n${bookLines.join('\n\n')}\n`;
}

function main() {
  const { year, input, output } = parseArgs();

  if (!year || !input || !output) {
    console.error('Usage: node scripts/parse-reading-list.js --year YYYY --input file.txt --output out.yaml');
    process.exit(1);
  }

  const raw = readFileSync(input, 'utf-8');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  let order = 1;
  const books = [];

  const seen = new Set();
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const book = parseLine(line, order++);
    const key = slugify(`${book.title}-${book.author}`);
    if (seen.has(key)) {
      console.warn(`  [DUPLICATE] Skipping duplicate at order ${book.order}: "${book.title}" by "${book.author}"`);
      order--;
      continue;
    }
    seen.add(key);
    books.push(book);
  }

  const needsReview = books.filter((b) => b.needs_review);
  if (needsReview.length) {
    console.warn(`\n${needsReview.length} entries flagged for review:`);
    needsReview.forEach((b) => console.warn(`  Order ${b.order}: "${b.title}" / "${b.author}"`));
  }

  writeFileSync(output, toYaml(year, books), 'utf-8');
  console.log(`\nWrote ${books.length} entries to ${output}`);
}

main();
