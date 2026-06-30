@echo off
REM Refresh publications from Zotero, then build the static site into _site\
ruby scripts\fetch_zotero.rb || exit /b 1
set JEKYLL_ENV=production
bundle exec jekyll build
