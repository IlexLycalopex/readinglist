import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface Book {
  id: string;
  title: string;
  author: string;
  year_published: number | null;
  pages: number | null;
  date_started: string | null;
  date_finished: string | null;
  year_read: number;
  order_read: number;
  format: 'print' | 'audio' | 'graphic';
  genre: string | null;
  cover_url: string | null;
  publisher: string | null;
  description: string | null;
  isbn: string | null;
  tags: string[];
  notes: string | null;
  reading: boolean;
  links: {
    openlibrary: string | null;
    wikipedia: string | null;
  };
}

export interface YearMeta {
  id: string;
  status: 'complete' | 'active';
}

export interface YearData {
  year: number;
  total_books: number;
  books: Book[];
}

export interface AuthorSummary {
  name: string;
  slug: string;
  bookCount: number;
  formats: Set<string>;
  years: number[];
  books: Book[];
}

export interface PublisherSummary {
  name: string;
  slug: string;
  bookCount: number;
  books: Book[];
  formats: Set<string>;
  years: number[];
}

const DATA_DIR = join(process.cwd(), 'src/data');

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugifyAuthor(name: string): string {
  return slugify(name);
}

export function loadYears(): YearMeta[] {
  const raw = readFileSync(join(DATA_DIR, 'years.yaml'), 'utf-8');
  return yaml.load(raw) as YearMeta[];
}

function rawBookToBook(raw: Record<string, unknown>, year: number): Book {
  const title = String(raw.title ?? '');
  const author = String(raw.author ?? '');
  const order = Number(raw.order ?? 0);

  const coverUrl = String(raw.cover_url ?? '') || null;
  const isbn = String(raw.isbn ?? '') || null;
  const description = String(raw.description ?? '') || null;
  const notes = String(raw.notes ?? '') || null;
  const publisher = String(raw.publisher ?? '') || null;
  const genre = raw.genre != null ? String(raw.genre) : null;
  const olLink = String((raw.links as Record<string, string>)?.openlibrary ?? '') || null;
  const wikiLink = String((raw.links as Record<string, string>)?.wikipedia ?? '') || null;

  const autoOl = olLink ?? `https://openlibrary.org/search?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
  const autoWiki = wikiLink ?? `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title + ' ' + author)}`;

  return {
    id: slugify(`${title}-${author}`),
    title,
    author,
    year_published: raw.year_published != null ? Number(raw.year_published) : null,
    pages: raw.pages != null ? Number(raw.pages) : null,
    date_started: raw.date_started != null ? String(raw.date_started) : null,
    date_finished: raw.date_finished != null ? String(raw.date_finished) : null,
    year_read: year,
    order_read: order,
    format: (raw.format as 'print' | 'audio' | 'graphic') ?? 'print',
    genre,
    cover_url: coverUrl,
    publisher,
    description,
    isbn,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    notes,
    reading: raw.reading === true,
    links: {
      openlibrary: autoOl,
      wikipedia: autoWiki,
    },
  };
}

export function loadYear(year: string): YearData {
  const raw = readFileSync(join(DATA_DIR, 'books', `${year}.yaml`), 'utf-8');
  const data = yaml.load(raw) as Record<string, unknown>;
  const yearNum = Number(data.year);
  const books = (data.books as Record<string, unknown>[]).map((b) => rawBookToBook(b, yearNum));
  books.sort((a, b) => a.order_read - b.order_read);
  return {
    year: yearNum,
    total_books: Number(data.total_books),
    books,
  };
}

export function loadAllYears(): YearData[] {
  const years = loadYears();
  return years.map((y) => loadYear(y.id));
}

export function loadAllBooks(): Book[] {
  return loadAllYears().flatMap((y) => y.books);
}

export function getAllAuthors(books: Book[]): AuthorSummary[] {
  const map = new Map<string, AuthorSummary>();
  for (const book of books) {
    if (!book.author) continue;
    const slug = slugifyAuthor(book.author);
    if (!map.has(slug)) {
      map.set(slug, { name: book.author, slug, bookCount: 0, formats: new Set(), years: [], books: [] });
    }
    const entry = map.get(slug)!;
    entry.bookCount++;
    entry.formats.add(book.format);
    if (!entry.years.includes(book.year_read)) entry.years.push(book.year_read);
    entry.books.push(book);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllPublishers(books: Book[]): PublisherSummary[] {
  const map = new Map<string, PublisherSummary>();
  for (const book of books) {
    if (!book.publisher) continue;
    const slug = slugify(book.publisher);
    if (!map.has(slug)) {
      map.set(slug, { name: book.publisher, slug, bookCount: 0, books: [], formats: new Set(), years: [] });
    }
    const entry = map.get(slug)!;
    entry.bookCount++;
    entry.books.push(book);
    entry.formats.add(book.format);
    if (!entry.years.includes(book.year_read)) entry.years.push(book.year_read);
  }
  return Array.from(map.values())
    .filter((p) => p.bookCount > 1)
    .sort((a, b) => a.name.localeCompare(b.name));
}
