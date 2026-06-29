#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Fetch a Zotero library and write _data/publications.yml for the Jekyll build.
#
# Config (from _config.yml → `zotero:` block):
#   library_type : "group" | "user"
#   library_id   : numeric id (string)
#   collection   : optional collection KEY to restrict to (blank = whole library)
#   latest_count : how many newest items to feature (default 6)
#   include_types: item types treated as publications
#
# Auth: set ZOTERO_API_KEY in the environment for a private library
#       (public libraries need no key).
#
# Thumbnails: drop an image in assets/images/pubs/ named after the DOI with
#   non-alphanumerics turned to "-" (e.g. 10.1109/LRA.2025.3565124 →
#   10-1109-lra-2025-3565124.jpg) or after the Zotero item key. Latest items
#   pick it up automatically.
#
# Offline test: set ZOTERO_FIXTURE=path/to/items.json to map a saved API
#   response instead of hitting the network.

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
COLLECTION   = (Z["collection"] || "").to_s
LATEST_COUNT = (Z["latest_count"] || 6).to_i
INCLUDE_TYPES = Z["include_types"] || %w[
  journalArticle conferencePaper preprint book bookSection thesis report
]
API_KEY = ENV["ZOTERO_API_KEY"]
PUBS_IMG_DIR = File.join(ROOT, "assets", "images", "pubs")

def log(msg) = warn("[fetch_zotero] #{msg}")

# ── Fetch every item (paginated) ─────────────────────────────────────────────
def fetch_all_items
  base = "https://api.zotero.org/#{LIBRARY_TYPE}s/#{LIBRARY_ID}"
  base += "/collections/#{COLLECTION}" unless COLLECTION.empty?
  base += "/items"

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
    total = res["Total-Results"].to_i
    start += limit
    log("fetched #{items.length}/#{total}")
    break if items.length >= total || page.empty?
  end
  items
end

def load_items
  fixture = ENV["ZOTERO_FIXTURE"]
  if fixture && !fixture.empty?
    log("using fixture #{fixture}")
    JSON.parse(File.read(fixture))
  else
    raise "zotero.library_id is not set in _config.yml" if LIBRARY_ID.empty?
    fetch_all_items
  end
end

# ── Map a Zotero item to our citation shape ──────────────────────────────────
def format_authors(creators)
  authors = (creators || []).select { |c| c["creatorType"] == "author" }
  authors = creators if authors.empty? # fall back to whatever creators exist
  names = authors.map do |c|
    next c["name"] if c["name"] # single-field name
    first = (c["firstName"] || "").split(/\s+/).reject(&:empty?)
                                  .map { |p| "#{p[0]}." }.join(" ")
    [first, c["lastName"]].reject { |s| s.nil? || s.empty? }.join(" ")
  end.reject(&:empty?)
  return "" if names.empty?
  names.length > 10 ? "#{names.first} et al." : names.join(", ")
end

VENUE_FIELDS = %w[publicationTitle proceedingsTitle bookTitle repository
                  publisher institution].freeze
TYPE_LABEL = {
  "journalArticle" => "Journal article", "conferencePaper" => "Conference paper",
  "preprint" => "Preprint", "book" => "Book", "bookSection" => "Book chapter",
  "thesis" => "Thesis", "report" => "Report"
}.freeze

def display_date(parsed, raw)
  return raw.to_s if parsed.to_s.empty?
  d = Date.parse(parsed) rescue nil
  return raw.to_s unless d
  # If Zotero only knew the year, parsedDate is YYYY-01-01 — show just the year.
  parsed =~ /\A\d{4}-01-01\z/ ? d.strftime("%Y") : d.strftime("%b %Y")
end

def thumbnail_for(doi, key)
  return nil unless Dir.exist?(PUBS_IMG_DIR)
  slugs = []
  slugs << doi.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "") unless doi.to_s.empty?
  slugs << key.downcase unless key.to_s.empty?
  slugs.each do |s|
    %w[jpg jpeg png webp].each do |ext|
      f = "#{s}.#{ext}"
      return "pubs/#{f}" if File.exist?(File.join(PUBS_IMG_DIR, f))
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
    "type_label" => TYPE_LABEL[d["itemType"]] || d["itemType"],
    "title" => (d["title"] || "Untitled").strip,
    "authors" => format_authors(d["creators"]),
    "venue" => venue,
    "date" => display_date(parsed, d["date"]),
    "year" => (parsed.to_s[0, 4].to_i if parsed),
    "doi" => (d["DOI"] unless d["DOI"].to_s.empty?),
    "url" => (d["url"] unless d["url"].to_s.empty?),
    "sort" => (parsed.to_s.empty? ? "0000-00-00" : parsed.to_s)
  }
end

# ── Build the data file ──────────────────────────────────────────────────────
raw = load_items
pubs = raw
       .reject { |it| %w[attachment note].include?(it.dig("data", "itemType")) }
       .map { |it| map_item(it) }
       .sort_by { |p| p["sort"] }
       .reverse

this_year = Time.now.year
refereed = pubs.select { |p| p["type"] == "journalArticle" }
grants = (YAML.load_file(File.join(ROOT, "_data", "grants.yml")) rescue []) || []

latest = pubs.first(LATEST_COUNT).map do |p|
  p.merge("fig" => thumbnail_for(p["doi"], p["key"]))
end

out = {
  "generated" => Time.now.utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
  "source" => COLLECTION.empty? ? "#{LIBRARY_TYPE} #{LIBRARY_ID}" : "#{LIBRARY_TYPE} #{LIBRARY_ID} / collection #{COLLECTION}",
  "stats" => [
    { "value" => pubs.length.to_s,     "label" => "Total publications" },
    { "value" => refereed.length.to_s, "label" => "Refereed journals" },
    { "value" => pubs.count { |p| p["year"] == this_year }.to_s, "label" => "Published #{this_year}" },
    { "value" => grants.length.to_s,   "label" => "Active programme grants" }
  ],
  "latest" => latest,
  "refereed" => refereed
}

# Drop transient sort keys from the serialised output.
[out["latest"], out["refereed"]].each { |list| list.each { |p| p.delete("sort") } }

dest = File.join(ROOT, "_data", "publications.yml")
File.write(dest, "# AUTO-GENERATED by scripts/fetch_zotero.rb — do not edit by hand.\n" \
                 "# Run `make fetch` (or the GitHub Action) to refresh from Zotero.\n" +
                 out.to_yaml)
log("wrote #{dest}: #{pubs.length} publications (#{refereed.length} refereed, #{latest.length} featured)")
