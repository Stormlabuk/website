source "https://rubygems.org"

# Jekyll 4 — built and deployed via GitHub Actions (see .github/workflows/pages.yml),
# which gives us a current Jekyll and the freedom to use any plugin.
gem "jekyll", "~> 4.3"

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.17"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-sitemap", "~> 1.4"
end

# Windows / JRuby timezone data
platforms :windows, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", :platforms => [:windows]
gem "webrick", "~> 1.8"
