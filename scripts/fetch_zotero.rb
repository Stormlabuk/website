#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Fetch one or more Zotero collections and write a data file per collection for
# the Jekyll build: _data/zotero/<slug>.yml, each with { latest, all }.
#
# Pages read their collection by slug:
#   * the Publications page uses `main`  → site.data.zotero.main
#   * each research page uses its own slug → site.data.zotero[page.slug]
#
# Config (from _config.yml → `zotero:` block):
#   library_type : "group" | "user"
#   library_id   : numeric id (string)
#   latest_count : how many newest items to feature (default 3)
#   include_types: item types treated as publications
#   collections  : { slug: "COLLECTIONKEY", ... }  (slug becomes the data file name)
#
# Auth: set ZOTERO_API_KEY in the environment for a private library.
# Thumbnails: drop an image in assets/images/pubs/ named after the DOI
#   (non-alphanumerics → "-") or the Zotero item key; featured items pick it up.
# Offline test: ZOTERO_FIXTURE=path/to/items.json maps a saved response for
#   every collection instead of hitting the network.

require "net/http"
require "uri"
require "json"
require "yaml"
require "date"
require "fileutils"

ROOT = File.expand_path("..", __dir__)
CONFIG = YAML.load_file(File.join(ROOT, "_config.yml")) || {}
Z = CONFIG["zotero"] || {}

LIBRARY_TYPE = (Z["library_type"] || "group").to_s
LIBRARY_ID   = (Z["library_id"] || "").to_s
LATEST_COUNT = (Z["latest_count"] || 3).to_i
COLLECTIONS  = Z["collections"] || {}
API_KEY = ENV["ZOTERO_API_KEY"]
PUBS_IMG_DIR = File.join(ROOT, "assets", "images", "pubs")
OUT_DIR = File.join(ROOT, "_data", "zotero")

def log(msg) = warn("[fetch_zotero] #{msg}")

# ── Fetch every item in a collection (paginated) ─────────────────────────────
def fetch_all_items(collection_key)
  base = "https://api.zotero.org/#{LIBRARY_TYPE}s/#{LIBRARY_ID}/collections/#{collection_key}/items"
  items = []
  start = 0
  limit = 100
  loop do
    uri = URI("#{base}?format=json&itemType=-attachment%20||%20note&limit=#{limit}&start=#{start}&sort=date&direction=desc")
    req = Net::HTTP::Get.new(uri)
    req["Zotero-API-Version"] = "3"
    req["Authorization"] = "Bearer #{API_KEY}" if API_KEY && !API_KEY.empty?
    res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
    raise "Zotero API #{res.code}: #{res.body[0, 300]}" unless res.code.to_i == 200

    page = JSON.parse(res.body)
    items.concat(page)
    break if page.length < limit
    start += limit
  end
  items
end

def load_items(collection_key)
  fixture = ENV["ZOTERO_FIXTURE"]
  if fixture && !fixture.empty?
    JSON.parse(File.read(fixture))
  else
    raise "zotero.library_id is not set in _config.yml" if LIBRARY_ID.empty?
    fetch_all_items(collection_key)
  end
end

# ── Map a Zotero item to our citation shape ──────────────────────────────────
def format_authors(creators)
  authors = (creators || []).select { |c| c["creatorType"] == "author" }
  authors = creators if authors.empty?
  names = (authors || []).map do |c|
    next c["name"] if c["name"]
    first = (c["firstName"] || "").split(/\s+/).reject(&:empty?).map { |p| "#{p[0]}." }.join(" ")
    [first, c["lastName"]].reject { |s| s.nil? || s.empty? }.join(" ")
  end.reject(&:empty?)
  return "" if names.empty?
  # STORM Lab house style: first 3 authors, then "et al."
  names.length > 3 ? "#{names[0, 3].join(', ')}, et al." : names.join(", ")
end

VENUE_FIELDS = %w[publicationTitle proceedingsTitle bookTitle repository publisher institution].freeze

def display_date(parsed, raw)
  return raw.to_s if parsed.to_s.empty?
  d = (Date.parse(parsed) rescue nil)
  return raw.to_s unless d
  parsed =~ /\A\d{4}-01-01\z/ ? d.strftime("%Y") : d.strftime("%b %Y")
end

def thumbnail_for(doi, key)
  return nil unless Dir.exist?(PUBS_IMG_DIR)
  slugs = []
  slugs << doi.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "") unless doi.to_s.empty?
  slugs << key.downcase unless key.to_s.empty?
  slugs.each do |s|
    %w[jpg jpeg png webp].each do |ext|
      return "pubs/#{s}.#{ext}" if File.exist?(File.join(PUBS_IMG_DIR, "#{s}.#{ext}"))
    end
  end
  nil
end

def map_item(it)
  d = it["data"] || {}
  meta = it["meta"] || {}
  parsed = meta["parsedDate"] || d["date"]
  venue = VENUE_FIELDS.map { |f| d[f] }.find { |v| v && !v.empty? }
  {
    "key" => it["key"],
    "type" => d["itemType"],
    "title" => (d["title"] || "Untitled").strip,
    "authors" => format_authors(d["creators"]),
    "venue" => venue,
    "date" => display_date(parsed, d["date"]),
    "year" => (parsed.to_s[0, 4].to_i if parsed),
    "doi" => (d["DOI"] unless d["DOI"].to_s.empty?),
    "sort" => (parsed.to_s.empty? ? "0000-00-00" : parsed.to_s)
  }
end

# ── Build a data file per collection ─────────────────────────────────────────
FileUtils.mkdir_p(OUT_DIR)
stamp = Time.now.utc.strftime("%Y-%m-%dT%H:%M:%SZ")
written = 0

COLLECTIONS.each do |slug, key|
  key = key.to_s
  if key.empty?
    log("skip '#{slug}' — no collection key set")
    next
  end
  raw = load_items(key)
  pubs = raw
         .reject { |it| %w[attachment note].include?(it.dig("data", "itemType")) }
         .map { |it| map_item(it) }
         .sort_by { |p| p["sort"] }
         .reverse
  latest = pubs.first(LATEST_COUNT).map { |p| p.merge("fig" => thumbnail_for(p["doi"], p["key"])) }

  out = {
    "generated" => stamp,
    "source" => "#{LIBRARY_TYPE} #{LIBRARY_ID} / collection #{key}",
    "latest" => latest,
    "all" => pubs
  }
  [out["latest"], out["all"]].each { |list| list.each { |p| p.delete("sort") } }

  dest = File.join(OUT_DIR, "#{slug}.yml")
  File.write(dest, "# AUTO-GENERATED by scripts/fetch_zotero.rb — do not edit by hand.\n" \
                   "# Collection '#{slug}' (#{key}). Run `make fetch` to refresh.\n" +
                   out.to_yaml)
  refereed = pubs.count { |p| p["type"] == "journalArticle" }
  log("wrote #{dest}: #{pubs.length} publications (#{refereed} refereed, #{latest.length} featured)")
  written += 1
end

log("done — #{written} collection file(s) written to _data/zotero/")
