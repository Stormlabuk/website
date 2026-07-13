# encoding: utf-8
"""Convert a WordPress export into Jekyll _news/*.md files for STORM Lab UK.

- HTML content -> clean Markdown (html.parser based).
- Featured image (via _thumbnail_id) + inline images rewritten to /assets/images/news/.
- Research-hub tag assigned by keyword scoring (empty when unsure).
- Category mapped to News / Publication / Award.
- Emits an image manifest (remote url -> local path) for a separate fetch step.
"""
import xml.etree.ElementTree as ET
import html, re, os, json
from html.parser import HTMLParser

import sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "wordpress-export.xml")
NEWS_DIR = os.path.join(ROOT, "_news")
MANIFEST = os.path.join(ROOT, "scripts", "news_images.tsv")

NS = {
    'wp': 'http://wordpress.org/export/1.2/',
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'excerpt': 'http://wordpress.org/export/1.2/excerpt/',
    'dc': 'http://purl.org/dc/elements/1.1/',
}

IMG_HOST_RE = re.compile(r'https?://(?:www\.)?stormlabuk\.com/wp-content/uploads/([^\s"\')]+)', re.I)

# ── image manifest: remote_url -> local path (assets/images/news/<basename>) ──
manifest = {}  # remote_url -> local_rel (e.g. news/foo.jpg)

def register_image(remote_url):
    remote_url = html.unescape(remote_url).strip()
    if not remote_url:
        return ""
    m = IMG_HOST_RE.search(remote_url)
    if not m:
        return ""  # not a site-hosted image; skip rewriting
    # normalise to https + www and full-size original
    base = os.path.basename(m.group(1).split('?')[0])
    local = "news/" + base
    canonical = "https://www.stormlabuk.com/wp-content/uploads/" + m.group(1).split('?')[0]
    manifest[canonical] = local
    return local

# ── HTML -> Markdown ─────────────────────────────────────────────────────────
class MD(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.list_stack = []
        self.a_href = None
        self.skip_depth = 0  # inside script/style
        self.strong_depth = 0
        self.em_depth = 0

    def _emit(self, s):
        self.out.append(s)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'):
            self.skip_depth += 1
        elif tag in ('p', 'div'):
            self._emit("\n\n")
        elif tag in ('br',):
            self._emit("  \n")
        elif tag in ('strong', 'b'):
            if self.strong_depth == 0:
                self._emit("**")
            self.strong_depth += 1
        elif tag in ('em', 'i'):
            if self.em_depth == 0:
                self._emit("_")
            self.em_depth += 1
        elif tag in ('h1', 'h2', 'h3', 'h4'):
            self._emit("\n\n## ")
        elif tag == 'a':
            self.a_href = a.get('href', '').strip()
            self._emit("[")
        elif tag == 'ul':
            self.list_stack.append('ul'); self._emit("\n\n")
        elif tag == 'ol':
            self.list_stack.append('ol'); self._emit("\n\n")
        elif tag == 'li':
            self._emit("\n- ")
        elif tag == 'img':
            src = register_image(a.get('src', ''))
            alt = a.get('alt', '').strip()
            if src:
                self._emit("\n\n![%s](/assets/images/%s)\n\n" % (alt, src))
        elif tag == 'blockquote':
            self._emit("\n\n> ")

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip_depth = max(0, self.skip_depth - 1)
        elif tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote'):
            self._emit("\n\n")
        elif tag in ('strong', 'b'):
            self.strong_depth = max(0, self.strong_depth - 1)
            if self.strong_depth == 0:
                self._emit("**")
        elif tag in ('em', 'i'):
            self.em_depth = max(0, self.em_depth - 1)
            if self.em_depth == 0:
                self._emit("_")
        elif tag == 'a':
            href = self.a_href or ""
            self._emit("](%s)" % href)
            self.a_href = None
        elif tag in ('ul', 'ol'):
            if self.list_stack:
                self.list_stack.pop()
            self._emit("\n\n")

    def handle_data(self, data):
        if self.skip_depth:
            return
        self._emit(data)

    def result(self):
        text = "".join(self.out)
        text = html.unescape(text)
        # strip stray shortcodes
        text = re.sub(r'\[/?[a-z][a-z0-9_\- ]*\]', '', text)
        # collapse 3+ newlines
        text = re.sub(r'[ \t]+\n', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        # collapse runs of spaces (not newlines)
        text = re.sub(r'[ \t]{2,}(?!\n)', ' ', text)
        # drop space before sentence punctuation (from tag boundaries)
        text = re.sub(r'(?<=\S)[ \t]+([,.;:!?])', r'\1', text)
        # normalise bold/italic runs split across adjacent tags:
        #   "</strong><i><strong>" etc. serialises to "**_**" — a bold break that
        #   should just be an italic toggle inside continuing bold.
        text = text.replace("**_**", "_")
        # move stray whitespace out of bold spans so kramdown closes them:
        #   "**seven **new" -> "**seven** new"
        text = re.sub(r'\*\*([^*\n]+?) +\*\*', r'**\1** ', text)
        text = re.sub(r'\*\* +([^*\n]+?)\*\*', r' **\1**', text)
        # collapse degenerate/empty emphasis (e.g. "** **", "****", "__")
        for _ in range(3):
            text = re.sub(r'\*\*([ \t]*)\*\*', r'\1', text)
            text = re.sub(r'(?<!_)_([ \t]*)_(?!_)', r'\1', text)
        return text.strip() + "\n"

def to_markdown(html_str):
    p = MD()
    p.feed(html_str or "")
    return p.result()

def plain_text(html_str):
    # crude strip for excerpt
    t = re.sub(r'<[^>]+>', ' ', html_str or "")
    t = html.unescape(t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'\s+([,.;:!?)])', r'\1', t)   # drop space before punctuation
    t = re.sub(r'\(\s+', '(', t)
    return t

def make_excerpt(html_str, limit_words=32):
    t = plain_text(html_str)
    words = t.split()
    if not words:
        return ""
    if len(words) <= limit_words:
        return t
    return " ".join(words[:limit_words]).rstrip(",.;:") + "…"

# ── research-hub assignment ──────────────────────────────────────────────────
HUB_KEYWORDS = [
    ('magnetic-vine-robots', [
        ('vine robot', 8), ('vine-robot', 8), ('growing robot', 5), ('everting', 5),
        ('eversion', 4),
    ]),
    ('magnetically-guided-ultrasound', [
        ('ultrasound', 4), ('ultrasonic', 4), ('sonopill', 5), ('sonic', 2), ('seus', 4),
        ('intravascular ultrasound', 5),
    ]),
    ('mri-actuated-instruments', [
        ('mri', 4), ('magnetic resonance', 5), ('robomri', 6), ('mri-actuated', 6),
        ('mri actuated', 6), ('mri-powered', 5), ('scanner', 1),
    ]),
    ('magnetic-tentacles', [
        ('tentacle', 6), ('nolimits', 6), ('continuum robot', 5), ('continuum manipulator', 5),
        ('soft continuum', 4), ('magnetic soft', 3), ('soft magnetic', 3), ('bronchoscopy', 3),
        ('lung', 2), ('soft magnetic robot', 4), ('soft magnetic catheter', 5), ('catheter', 3),
        ('material point method', 4), ('coiling', 2), ('variable stiffness', 2),
    ]),
    ('autonomy-in-surgical-robotics', [
        ('autonom', 5), ('autonomy', 5), ('shared control', 5), ('reinforcement learning', 5),
        ('imitation learning', 5), ('da vinci', 4), ('dvrk', 5), ('deformable object', 5),
        ('surgical robot', 2), ('control policy', 4), ('surgical gesture', 4), ('skill assessment', 3),
        ('computer vision', 2), ('surgical scene', 4), ('semantic', 2), ('automating', 5),
        ('automated', 3), ('organ conformation', 6), ('surgical gesture', 4),
    ]),
    ('magnetic-flexible-endoscopy', [
        ('endoscop', 4), ('colonoscop', 5), ('colorectal', 4), ('capsule', 4), ('bowel', 3),
        ('gastric', 3), ('gastrointestinal', 3), ('gi tract', 4), ('flexible endoscope', 6),
        ('magnetic flexible endoscope', 7), ('mfe', 4), ('screening', 2), ('helicobacter', 3),
        ('pylori', 3), ('pillbot', 4), ('pancrea', 2),
    ]),
]

def assign_hub(title, content):
    text = (title + " " + plain_text(content)).lower()
    best, best_score = "", 0
    for hub, kws in HUB_KEYWORDS:
        score = sum(w for kw, w in kws if kw in text)
        if score > best_score:
            best, best_score = hub, score
    # require a reasonable confidence
    return best if best_score >= 4 else ""

# ── category / award detection ───────────────────────────────────────────────
AWARD_RE = re.compile(
    r'\b(award|awarded|prize|best paper|best poster|finalist|shortlist|winner|wins|won\b|'
    r'honou?red|fellowship|medal|recogni[sz]ed|nomination|nominated|elected fellow)\b', re.I)

def map_category(title, content, cats):
    t = title + " " + plain_text(content)[:400]
    if AWARD_RE.search(t):
        return "Award"
    if 'publication' in cats:
        return "Publication"
    # infer publication from strong signals
    if re.search(r'\b(publish|published|new paper|journal|proceedings|accepted (?:at|to)|IEEE|our paper)\b', title, re.I):
        return "Publication"
    return "News"

# ── main ─────────────────────────────────────────────────────────────────────
def main():
    root = ET.parse(SRC).getroot()
    items = root.findall('.//item')
    att = {}
    posts = []
    for it in items:
        pt = it.findtext('wp:post_type', default='', namespaces=NS)
        if pt == 'attachment':
            pid = it.findtext('wp:post_id', default='', namespaces=NS)
            url = it.findtext('wp:attachment_url', default='', namespaces=NS)
            if pid and url:
                att[pid] = url
        elif pt == 'post':
            posts.append(it)

    pub = [p for p in posts if p.findtext('wp:status', default='', namespaces=NS) == 'publish']

    os.makedirs(NEWS_DIR, exist_ok=True)
    written = []
    no_hub = []
    for p in pub:
        title = (p.findtext('title') or "").strip()
        slug = (p.findtext('wp:post_name', default='', namespaces=NS) or "").strip()
        # WordPress fallback slugs like "803-2" (numeric/duplicate) -> derive from title
        if not slug or re.fullmatch(r'\d+(-\d+)?', slug):
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:80]
        date_full = (p.findtext('wp:post_date', default='', namespaces=NS) or "").strip()
        content = p.findtext('content:encoded', default='', namespaces=NS) or ""
        wp_excerpt = p.findtext('excerpt:encoded', default='', namespaces=NS) or ""
        cats = [c.get('nicename') for c in p.findall('category') if c.get('domain') == 'category']

        # featured image
        tid = None
        for m in p.findall('wp:postmeta', NS):
            if m.findtext('wp:meta_key', default='', namespaces=NS) == '_thumbnail_id':
                tid = m.findtext('wp:meta_value', default='', namespaces=NS)
        image = ""
        if tid and tid in att:
            image = register_image(att[tid])

        body = to_markdown(content)
        excerpt = plain_text(wp_excerpt) or make_excerpt(content)
        category = map_category(title, content, cats)
        hub = assign_hub(title, content)
        if not hub:
            no_hub.append((date_full[:10], title))

        # front matter (escape double quotes in strings)
        def q(s):
            return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

        fm = ["---",
              "title: " + q(title),
              "slug: " + slug,
              'category: ' + q(category),
              "hub: " + (hub if hub else '""'),
              "date: " + date_full,
              "image: " + (q(image) if image else '""'),
              "excerpt: " + q(excerpt),
              "---", ""]
        out = "\n".join(fm) + body
        path = os.path.join(NEWS_DIR, slug + ".md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(out)
        written.append((date_full[:10], category, hub, slug))

    # manifest
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        for url, local in sorted(manifest.items()):
            f.write(url + "\t" + local + "\n")

    print("Wrote %d news files to %s" % (len(written), NEWS_DIR))
    print("Image manifest: %d unique images -> %s" % (len(manifest), MANIFEST))
    from collections import Counter
    print("Categories:", dict(Counter(w[1] for w in written)))
    print("Hub assigned:", sum(1 for w in written if w[2]), "/", len(written))
    print("Hub distribution:", dict(Counter(w[2] or '(none)' for w in written)))
    print("\n=== FULL ASSIGNMENT LIST (date | category | hub | slug) ===")
    for d, c, h, s in sorted(written):
        print("  %s | %-11s | %-30s | %s" % (d, c, h or '(none)', s))
    print("\nPosts with NO hub (%d):" % len(no_hub))
    for d, t in sorted(no_hub):
        print("  ", d, t)

if __name__ == "__main__":
    main()
