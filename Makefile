# STORM Lab UK website — local development helpers.
# Usage: `make setup`, then `make serve` and open http://localhost:4000

.PHONY: setup serve build clean

setup:        ## Install Ruby gem dependencies
	bundle install

serve:        ## Run the site locally with live reload at http://localhost:4000
	bundle exec jekyll serve --livereload

build:        ## Build the static site into _site/
	JEKYLL_ENV=production bundle exec jekyll build

clean:        ## Remove the generated site and caches
	bundle exec jekyll clean
