# STORM Lab UK — website

Static [Jekyll](https://jekyllrb.com/) site for **STORM Lab UK** (Science and
Technology Of Robotics in Medicine), University of Leeds. A flat-file port of the
WordPress site, deployed to GitHub Pages.

## Editing content

Most updates are data-only — no templates to touch:

| What | Where |
| --- | --- |
| Navigation | `_data/navigation.yml` |
| Team members | `_data/team.yml` (photos in `assets/images/team/`) |
| Research themes (cards) | `_data/research.yml` |
| Research theme pages | `_research/*.md` |
| Publications | `_data/publications.yml` |
| News posts | `_news/YYYY-MM-DD-title.md` |
| Site title, contact, branding | `_config.yml` |

Page bodies (Home, About, Contact, etc.) are Markdown/HTML files at the repo root.

## Design system

The visual design is driven entirely by CSS custom properties (design tokens) in
[`_sass/_tokens.scss`](_sass/_tokens.scss). This is the single integration point
for the Claude Design system — map the design's colours, type scale, spacing and
radii onto those variables and the whole site re-skins.

## Local development

```bash
bundle install
bundle exec jekyll serve
# open http://localhost:4000
```

## Deployment

Pushing to the default branch triggers `.github/workflows/pages.yml`, which builds
the site with Jekyll and deploys it to GitHub Pages. In the repository settings,
set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

If publishing from a project subpath (`https://USER.github.io/REPO`), set
`baseurl: "/REPO"` in `_config.yml`.
