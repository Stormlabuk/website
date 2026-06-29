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

## The contact form

GitHub Pages is static, so the form needs an external handler. Create a free
form at [Formspree](https://formspree.io) and paste its endpoint into
`contact_form_action` in `_config.yml`. If left blank, the form falls back to a
`mailto:` submission.

## Local development

```bash
bundle install
bundle exec jekyll serve   # → http://localhost:4000
```

## Deployment

Pushing triggers `.github/workflows/pages.yml`, which builds with Jekyll 4 and
deploys to GitHub Pages. **In the repository settings, set
Settings → Pages → Source to "GitHub Actions"** (not "Deploy from a branch" —
this site uses Jekyll 4 and Dart-Sass `@use`, which the classic branch build
does not support).

If publishing from a project subpath (`https://USER.github.io/REPO`), set
`baseurl: "/REPO"` in `_config.yml`.
