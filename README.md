# STORM Lab UK — website

Static [Jekyll](https://jekyllrb.com/) site for **STORM Lab UK** (Science and
Technology Of Robotics in Medicine), University of Leeds — a flat-file port of
the WordPress site, built on the STORM Lab **Claude Design** system and deployed
to GitHub Pages.

## Editing content

Most updates are data-only — no templates to touch:

| What | Where |
| --- | --- |
| Primary navigation | `_data/navigation.yml` |
| Footer columns | `_data/footer.yml` |
| Research areas (home grid, nav dropdown) | `_data/research.yml` |
| Research project pages | `_research/<slug>.md` (front matter drives the layout) |
| Programme grants (Research page) | `_data/grants.yml` |
| Publications | **automatic from Zotero** — see below (don't edit `_data/publications.yml` by hand) |
| Team members | `_data/team.yml` (add `photo:` to replace the monogram tile) |
| Publications | `_data/publications.yml` |
| Home "expertise" cards | `_data/expertise.yml` |
| Sponsors & partners | `_data/sponsors.yml` |
| News posts | `_news/<slug>.md` |
| Site title, contact, form endpoint | `_config.yml` |

Page bodies (Home, About, Research, Team, Publications, News, Contact) are
HTML/Markdown files at the repo root.

## Design system

The visual language comes from the STORM Lab Claude Design project. Its tokens
are ported verbatim into [`_sass/_tokens.scss`](_sass/_tokens.scss) — the single
place to adjust colours, type, spacing, radii and effects. Brand utilities
(`.eyebrow`, `.storm-mark`, `.storm-bar`, dither panels) live in `_sass/_base.scss`;
components and page layouts in `_sass/_components.scss` and `_sass/_layout.scss`.
The React component library was translated into static Jekyll templates — no
React ships in the final site. The brand canvas animations (magnetic field,
localisation, soft robot, and the tentacle hero) are reimplemented in vanilla
JS in [`assets/js/main.js`](assets/js/main.js) and respect `prefers-reduced-motion`.

Brand assets (logos, illustrations, research/news/sponsor imagery) are in
`assets/images/`.

## Publications (automatic from Zotero)

The Publications page is generated from a Zotero library by
[`scripts/fetch_zotero.rb`](scripts/fetch_zotero.rb), which writes
`_data/publications.yml`. The committed file is a seed; refreshing replaces it
with live data.

**Configure** the library in `_config.yml` under `zotero:` — set `library_type`
(`group`/`user`) and the numeric `library_id`. Optionally restrict to one
`collection`, and set how many items are featured (`latest_count`).

**Refresh:**

```bash
make fetch        # pulls Zotero → _data/publications.yml
make serve        # serve/build already run fetch for you
```

For a **private** library, set a read-only key first:
`export ZOTERO_API_KEY=xxxx` (locally) or add it as the repository secret
`ZOTERO_API_KEY` for the "Refresh publications from Zotero" Action
(`.github/workflows/refresh-publications.yml`, manual by default).

The page splits into **Latest** (the newest `latest_count` items, with
thumbnails) and **Refereed Journals** (every `journalArticle`). Stats
(total / refereed / published-this-year) are computed automatically; the grant
count comes from `_data/grants.yml`.

**Thumbnails** (Latest items only): drop an image in `assets/images/pubs/` named
after the DOI with non-alphanumerics turned to `-`
(e.g. `10.1109/LRA.2025.3565124` → `10-1109-lra-2025-3565124.jpg`) or after the
Zotero item key. It's picked up automatically on the next `make fetch`.

## The contact form

GitHub Pages is static, so the form needs an external handler. Create a free
form at [Formspree](https://formspree.io) and paste its endpoint into
`contact_form_action` in `_config.yml`. If left blank, the form falls back to a
`mailto:` submission.

## Local development

```bash
make setup     # bundle install
make serve     # → http://localhost:4000 (live reload)
```

Or without `make`:

```bash
bundle install
./bin/jekyll serve         # robust across Bundler versions
# or: bundle exec jekyll serve
```

`make build` produces the static site in `_site/` if you want to inspect or
host the output yourself.

## Publishing (currently OFF)

The site is set up for **local use only** — nothing is published automatically.
The GitHub Actions workflow in `.github/workflows/pages.yml` runs **only when
triggered manually**, so a private repository stays private.

When you want to go live (public repo, or a plan that allows Pages on private
repos): enable **Settings → Pages → Source: GitHub Actions**, then switch the
workflow's `on:` trigger to run on push (see the comments at the top of
`pages.yml`). For a project subpath (`https://USER.github.io/REPO`) also set
`baseurl: "/REPO"` in `_config.yml`. The site uses Jekyll 4 and Dart-Sass
`@use`, so use the **GitHub Actions** source, not "Deploy from a branch".
