@echo off
REM Refresh publications from Zotero, then serve the site at http://localhost:4000
ruby scripts\fetch_zotero.rb || exit /b 1
bundle exec jekyll serve --livereload
