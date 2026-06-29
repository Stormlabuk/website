# STORM Lab UK website — local development helpers.
# Usage: `make setup`, then `make serve` and open http://localhost:4000

.PHONY: setup fetch serve build clean

setup:        ## Install Ruby gem dependencies
	bundle install

fetch:        ## Pull publications from Zotero into _data/publications.yml
	ruby scripts/fetch_zotero.rb

serve: fetch  ## Refresh publications, then run locally with live reload
	bundle exec jekyll serve --livereload

build: fetch  ## Refresh publications, then build the static site into _site/
	JEKYLL_ENV=production bundle exec jekyll build

clean:        ## Remove the generated site and caches
	bundle exec jekyll clean
