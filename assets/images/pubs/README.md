# Publication thumbnails

Drop a figure image here to use as the thumbnail on the Publications page's
**Latest / Featured** cards (the newest few papers). The Zotero fetch
(`scripts/fetch_zotero.rb`) looks for a file in this folder named after either:

- the paper's **DOI**, lowercased with every non-alphanumeric run replaced by `-`
  (e.g. DOI `10.1007/s11071-026-12856-3` → `10-1007-s11071-026-12856-3.png`), or
- the **Zotero item key**, lowercased (e.g. `HXJ6Y3ZJ` → `hxj6y3zj.png`).

Accepted extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.

After adding an image, run the **Refresh publications from Zotero** workflow
(Actions tab) so the fetch re-scans this folder and links the thumbnail; the
site redeploys automatically.

Note: thumbnails currently show only on the featured cards (the latest few
papers), not on every row of the complete index.
