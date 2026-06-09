#!/usr/bin/env node
/**
 * Fetches cover URLs, ISBN, publisher, genre, and description for books
 * where cover_url is empty. Sources: Open Library (primary), Google Books (fallback).
 *
 * Usage:
 *   npm run fetch-metadata          # all years
 *   npm run fetch-metadata -- 2025  # specific year
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/data/books');

const DELAY_MS = 500;
const MAX_RETRIES = 3;
const USER_AGENT = 'readinglist-app/1.0 (https://github.com/IlexLycalopex/readinglist)';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await sleep(DELAY_MS * Math.pow(2, i));
    }
  }
}

function cleanTitleForSearch(title) {
  // "Chew Vol 9 Chicken Tenders" → "Chew Chicken Tenders"
  // "DMZ Vol 1 On the Ground" → "DMZ On the Ground"
  // "The Massive Volume 4" → "The Massive"
  const m = title.match(/^(.+?)\s+Vol(?:ume)?\s+\d+\s*(.*)/i);
  if (m) {
    const series = m[1].trim();
    const subtitle = m[2].trim();
    return subtitle ? `${series} ${subtitle}` : series;
  }
  return title;
}

async function fetchOpenLibrary(title, author) {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5&fields=cover_i,isbn,first_publish_year,publisher,subject,key`;
  const data = await fetchWithRetry(url);
  const doc = data.docs?.[0];
  if (!doc) return null;

  const coverId = doc.cover_i;
  return {
    cover_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    isbn: doc.isbn?.[0] ?? null,
    year_published: doc.first_publish_year ?? null,
    publisher: doc.publisher?.[0] ?? null,
    genre: doc.subject?.slice(0, 2).join(', ') ?? null,
    openlibrary: doc.key ? `https://openlibrary.org${doc.key}` : null,
  };
}

async function fetchGoogleBooks(title, author) {
  const q = encodeURIComponent(`intitle:${title} inauthor:${author}`);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}`;
  const data = await fetchWithRetry(url);
  const item = data.items?.[0]?.volumeInfo;
  if (!item) return null;

  return {
    cover_url: item.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
    publisher: item.publisher ?? null,
    genre: item.categories?.[0] ?? null,
    description: item.description ? item.description.slice(0, 300) : null,
    year_published: item.publishedDate ? parseInt(item.publishedDate) : null,
  };
}

async function processYear(yearFile) {
  const filePath = join(DATA_DIR, yearFile);
  let content = readFileSync(filePath, 'utf-8');
  const originalBookCount = yaml.load(content).books.length;

  const bookBlocks = content.split(/(?=\n  - order:)/);

  let updated = false;
  const processedBlocks = [];

  for (const block of bookBlocks) {
    if (!block.includes('cover_url: ""')) {
      processedBlocks.push(block);
      continue;
    }

    const titleMatch = block.match(/title:\s*"([^"]+)"/);
    const authorMatch = block.match(/author:\s*"([^"]+)"/);

    if (!titleMatch || !authorMatch) {
      processedBlocks.push(block);
      continue;
    }

    const title = titleMatch[1];
    const author = authorMatch[1].split(';')[0].trim();
    const searchTitle = cleanTitleForSearch(title);

    console.log(`  Fetching: "${title}" by ${author}${searchTitle !== title ? ` (searching: "${searchTitle}")` : ''}`);

    let meta = null;
    try {
      meta = await fetchOpenLibrary(searchTitle, author);
      if (meta) console.log(`    ✓ Open Library`);
    } catch (err) {
      console.log(`    ✗ Open Library failed: ${err.message}`);
    }

    let gMeta = null;
    const needsGBooks = !meta?.cover_url || !meta?.description;
    if (needsGBooks) {
      try {
        gMeta = await fetchGoogleBooks(searchTitle, author);
        if (gMeta) console.log(`    ✓ Google Books`);
      } catch (err) {
        console.log(`    ✗ Google Books failed: ${err.message}`);
      }
    }

    let b = block;
    const coverUrl = meta?.cover_url ?? gMeta?.cover_url ?? '';
    const isbn = meta?.isbn ?? '';
    const yearPub = meta?.year_published ?? gMeta?.year_published ?? null;
    const publisher = meta?.publisher ?? gMeta?.publisher ?? '';
    const genre = meta?.genre ?? gMeta?.genre ?? '';
    const description = gMeta?.description ?? '';
    const olLink = meta?.openlibrary ?? '';

    if (coverUrl) b = b.replace(/cover_url:\s*""/, `cover_url: "${coverUrl}"`);
    if (isbn) b = b.replace(/isbn:\s*""/, `isbn: "${isbn}"`);
    if (yearPub && b.includes('year_published: null')) b = b.replace(/year_published: null/, `year_published: ${yearPub}`);
    if (publisher) b = b.replace(/publisher:\s*null/, `publisher: "${publisher.replace(/"/g, '\\"')}"`);
    if (genre) b = b.replace(/genre:\s*null/, `genre: "${genre.replace(/"/g, '\\"')}"`);
    if (description) b = b.replace(/description:\s*""/, `description: "${description.replace(/"/g, '\\"')}"`);
    if (olLink) b = b.replace(/openlibrary:\s*""/, `openlibrary: "${olLink}"`);

    processedBlocks.push(b);
    updated = true;

    await sleep(DELAY_MS);
  }

  if (updated) {
    const output = processedBlocks.join('');
    // The edits above are regex-based; refuse to save anything that no longer parses
    const parsed = yaml.load(output);
    if (!Array.isArray(parsed?.books) || parsed.books.length !== originalBookCount) {
      throw new Error(`refusing to save ${yearFile}: edited YAML is invalid or lost entries`);
    }
    writeFileSync(filePath, output, 'utf-8');
    console.log(`  → Saved ${yearFile}`);
  } else {
    console.log(`  → No updates needed for ${yearFile}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const specificYear = args[0];

  const files = specificYear
    ? [`${specificYear}.yaml`]
    : readdirSync(DATA_DIR).filter((f) => f.endsWith('.yaml'));

  for (const file of files) {
    console.log(`\nProcessing ${file}…`);
    try {
      await processYear(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
