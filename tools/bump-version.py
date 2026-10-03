"""Set the ?v= cache-busting tags in index.html from the content of the CSS and JS.

Run before every publish:  python tools/bump-version.py
The tag only changes when the file really changed, so browsers never serve a stale copy.
"""
import hashlib
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
html_path = root / 'index.html'
html = html_path.read_text(encoding='utf-8')

for asset in ('css/style.css', 'js/main.js'):
    digest = hashlib.sha1((root / asset).read_bytes()).hexdigest()[:10]
    html, count = re.subn(rf'{re.escape(asset)}\?v=[\w-]+', f'{asset}?v={digest}', html)
    print(f'{asset}: v={digest} ({count} reference{"s" if count != 1 else ""})')

html_path.write_text(html, encoding='utf-8', newline='\n')
