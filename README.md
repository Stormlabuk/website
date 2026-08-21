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
| Publications | **automatic from Zotero** — see below (don't edit `_data/zotero/*.yml` by hand) |
| Team members | `_data/team.yml` (add `photo:` to replace the monogram tile) |
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

Publication lists are generated from Zotero collections by
[`scripts/fetch_zotero.rb`](scripts/fetch_zotero.rb), which writes one file per
collection: `_data/zotero/<slug>.yml`. The committed files are seeds; refreshing
replaces them with live data.

**One collection per page.** Configure them in `_config.yml` under
`zotero.collections` — a map of `slug: "COLLECTION_KEY"` (the key is the code in
the Zotero URL, `…/collections/<KEY>/collection`):

- `main` drives the **Publications** page (`site.data.zotero.main`).
- Each **research** page reads the collection named after its slug — e.g. the
  page `_research/magnetic-tentacles.md` uses `_data/zotero/magnetic-tentacles.yml`.
  Leave a slug's key blank to skip it (the page then falls back to any
  `publications:` list in its front matter).

Also set `library_type` (`group`/`user`), the numeric `library_id`, and
`latest_count` (how many items are featured).

**Refresh:**

```bash
make fetch        # pulls every configured collection → _data/zotero/*.yml
make serve        # serve/build already run fetch for you
```

For a **private** library, set a read-only key first:
`export ZOTERO_API_KEY=xxxx` (locally) or add it as the repository secret
`ZOTERO_API_KEY` for the "Refresh publications from Zotero" Action
(`.github/workflows/refresh-publications.yml`, manual by default).

The Publications page shows **Latest / Featured** (the newest `latest_count`
items) and a **complete index grouped by year**; hero stats (total /
published-this-year / refereed) are computed automatically.

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

### macOS / Linux

```bash
make setup     # bundle install
make serve     # → http://localhost:4000 (live reload)
```

Or without `make`: `bundle install` then `bundle exec jekyll serve`.

### Windows

1. Install **Ruby+Devkit** from [rubyinstaller.org](https://rubyinstaller.org/)
   (pick a current 3.x "with Devkit"). At the end of the installer let it run
   `ridk install` and choose the **MSYS2 and MINGW development toolchain**.
2. Open a fresh terminal (PowerShell or Command Prompt) in the project folder
   and install dependencies:

   ```bat
   gem install bundler
   bundle install
   ```

3. Use the bundled helper scripts (no `make` needed):

   ```bat
   serve.cmd      :: refresh publications from Zotero, then serve
   build.cmd      :: refresh, then build into _site\
   fetch.cmd      :: just refresh _data\zotero\*.yml from Zotero
   ```

   Then open <http://localhost:4000>. (Equivalent manual command:
   `bundle exec jekyll serve --livereload`.)

   The Zotero collection is public, so no key is needed. For a private library,
   set it first — PowerShell: `$env:ZOTERO_API_KEY="xxxx"`, or
   Command Prompt: `set ZOTERO_API_KEY=xxxx`.

`make build` / `build.cmd` produces the static site in `_site/` if you want to
inspect or host the output yourself.

## Development & release

The site is live at **<https://www.stormlabuk.com>** and publishes from the
`main` branch via GitHub Actions.

**`main` is production.** Every merge into `main` triggers
`.github/workflows/pages.yml`, which builds the site and deploys it to the live
domain. Treat `main` as always-deployable — don't commit directly to it.

**To make a change:**

1. Branch off `main`: `git switch -c my-change main`
2. Commit your work and preview locally with `make serve`
   (→ <http://localhost:4000>).
3. Push the branch and open a **pull request** into `main`.
4. The **Build check** (`.github/workflows/ci.yml`) builds the site on the PR.
   If Jekyll can't build, the check fails and the PR is blocked.
5. Once the check is green, **merge**. The merge auto-deploys to
   www.stormlabuk.com within a couple of minutes.

`main` is protected: pull request required, the Build check must pass, and
force-pushes are blocked.

### Hosting notes

The site is served at the **custom-domain root**, so `baseurl` stays `""` and
`url` is `https://www.stormlabuk.com` in `_config.yml`; the `CNAME` file pins the
domain. Pages **Source** must be **GitHub Actions** (not "Deploy from a branch")
— the site uses Jekyll 4 and Dart-Sass `@use`. Do **not** pass `--baseurl` in the
build step; that would override `_config.yml` and 404 every asset at the root.
