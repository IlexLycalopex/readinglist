# Reading Log

A personal reading history across multiple years. Built with [Astro](https://astro.build) and deployed to GitHub Pages.

**Live site:** https://ilexlycalopex.github.io/readinglist/

---

## Adding a new year

1. Create `src/data/books/YYYY.yaml` — copy the structure from an existing year file.
2. Add the year to `src/data/years.yaml`:
   ```yaml
   - id: "YYYY"
     status: active   # or "complete" when the year is done
   ```
3. Run `npm run fetch-metadata -- YYYY` to pull cover images and book metadata.
4. Commit and push to `main` — GitHub Actions deploys automatically.

---

## Adding books during the year

Edit `src/data/books/YYYY.yaml` directly. Append a new entry at the bottom, incrementing `order`. Leave metadata fields blank — run `npm run fetch-metadata` afterwards to fill them in.

Minimal entry:
```yaml
  - order: 49
    title: "Book Title"
    author: "Author Name"
    pages: null
    date_started: null
    date_finished: null
    format: print          # print | audio | graphic
    year_published: null
    genre: null
    publisher: null
    cover_url: ""
    isbn: ""
    description: ""
    tags: []
    notes: ""
    links:
      openlibrary: ""
      wikipedia: ""
```

---

## Format values

| Emoji in source | `format` value |
|---|---|
| 📖 (book) | `print` |
| 👂 (ear/audio) | `audio` |
| 🃏 (playing card) | `graphic` |

---

## Fetching metadata

Metadata (cover images, ISBN, publisher, genre, description) is fetched automatically on every deployment — the GitHub Actions workflow runs `npm run fetch-metadata` before the build. Any entry with an empty `cover_url` gets populated at deploy time; entries that already have a URL are skipped.

To fetch locally before pushing:

```bash
npm run fetch-metadata          # all years
npm run fetch-metadata -- 2025  # specific year only
```

Covers are looked up by ISBN first (Open Library covers API), then via the
entry's `links.openlibrary` work (including its editions), then by
title/author search on Open Library and Google Books.

Google Books rate-limits unauthenticated requests from GitHub's shared
runners. To avoid this, create a free API key (Google Cloud Console →
"Books API") and add it as a repository secret named `GOOGLE_BOOKS_API_KEY`.

If a cover can't be found anywhere, paste any image URL into `cover_url`
manually — entries with a non-empty value are never touched.

Committing the filled YAML is optional — if you do, it avoids re-fetching those entries on the next deploy. If you don't, the deploy fetches them automatically and bakes the data into the built pages.

---

## Parsing a raw reading list

If you have a year's reading list as a plain text file (one book per line), the parser converts it to YAML:

```bash
node scripts/parse-reading-list.js --year 2024 --input data-raw/2024.txt --output src/data/books/2024.yaml
```

Input format:
```
1. Title - Author (pages) (DD/MM/YYYY - DD/MM/YYYY)
2. Title - Author 👂
3. Title - Author 🃏
```

Ambiguous entries are flagged with `needs_review: true` and printed to stdout — review those manually before committing.

---

## Development

```bash
npm install        # install dependencies
npm run dev        # local dev server at http://localhost:4321/readinglist/
npm run build      # production build to dist/
npm run preview    # preview the production build locally
```

---

## Design tokens

Inherited from the grackles.co.uk family. Key colours:

| Token | Value | Use |
|---|---|---|
| `--accent` | `#d4714a` | Print books, primary accent |
| `--accent-audio` | `#6a9fd4` | Audio books |
| `--accent-graphic` | `#4caf82` | Graphic novels |
| `--bg` | `#0b0908` | Page background |
| `--text` | `#f0ebe3` | Body text |

---

## Deployment

GitHub Actions deploys to GitHub Pages on every push to `main`. The workflow is at `.github/workflows/deploy.yml`.

When the site moves to `grackles.co.uk/readinglist`, update `astro.config.mjs`:
```js
export default defineConfig({
  site: 'https://grackles.co.uk',
  base: '/readinglist',
  output: 'static',
});
```

---

## File structure

```
src/
  components/       BookCard, GroupCard, FilterBar, YearNav, SiteNav
  data/
    years.yaml      index of all years
    books/
      2025.yaml     one file per year
  layouts/Base.astro
  lib/data.ts       data loading and type definitions
  pages/            all routes
  styles/global.css design tokens and global styles
scripts/
  fetch-metadata.js runs on demand to fill in book data
  parse-reading-list.js one-time parser for raw text lists
```
