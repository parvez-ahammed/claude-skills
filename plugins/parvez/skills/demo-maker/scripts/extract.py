"""Split snapshots from helpers.js __snap into one shared stylesheet and per-state body parts.

Usage: python extract.py --origin http://localhost:5173 [--capture DIR] [--demo DIR] [names...]

Snapshots are <capture>/<name>.html. Without names, every *.html in <capture> is used in file-name
order, so name them 01-..., 02-... in the order you took them: the LAST one supplies the CSS.
"""
import argparse
import glob
import hashlib
import os
import re
import ssl
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

parser = argparse.ArgumentParser()
parser.add_argument("--origin", required=True, help="app origin, for example http://localhost:5173")
parser.add_argument("--capture", default=HERE)
parser.add_argument("--demo", default=os.path.join(os.path.dirname(HERE), "demo"))
parser.add_argument("names", nargs="*")
args = parser.parse_args()

ORIGIN = args.origin.rstrip("/")
ASSETS = os.path.join(args.demo, "assets")
PARTS = os.path.join(args.capture, "parts")
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(PARTS, exist_ok=True)

# Local dev servers often use self-signed certificates.
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

names = args.names or sorted(
    os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(args.capture, "*.html"))
)
if not names:
    raise SystemExit("no snapshots in " + args.capture)


def read(name):
    with open(os.path.join(args.capture, name + ".html"), encoding="utf-8") as f:
        return f.read()


def local_asset(url):
    clean = url.split("#")[0]
    # "http://host/page#filter0_d" is an in-document SVG reference, not a file: keep only the fragment.
    if "#" in url and "." not in os.path.basename(clean):
        return "#" + url.split("#", 1)[1]
    base = os.path.basename(clean.split("?")[0]) or "asset"
    name = hashlib.md5(clean.encode()).hexdigest()[:8] + "-" + base
    path = os.path.join(ASSETS, name)
    if not os.path.exists(path):
        try:
            data = urllib.request.urlopen(clean, context=ctx, timeout=30).read()
            with open(path, "wb") as f:
                f.write(data)
        except Exception as e:
            print("FAILED", clean, e)
            return url
    return "assets/" + name + url[len(clean):]


ORIGIN_URL = re.escape(ORIGIN) + r'[^"]+'


def localise_css(text):
    return re.sub(r'(url\(")(' + ORIGIN_URL + r')(")', lambda m: m.group(1) + local_asset(m.group(2)) + m.group(3), text)


def style_of(html):
    return re.search(r"<style>(.*?)</style></head>", html, re.S).group(1)


css = localise_css(style_of(read(names[-1])))
# app.css sits inside assets/, so its own references drop the folder prefix.
with open(os.path.join(ASSETS, "app.css"), "w", encoding="utf-8", newline="\n") as f:
    f.write(css.replace('url("assets/', 'url("'))
print("css from", names[-1], len(css))

class_re = r"\.(css-[a-z0-9]+(?:-[A-Za-z0-9]+)?)"
known = set(re.findall(class_re, css))
for name in names:
    html = read(name)
    body = html[html.index("<body"):]
    body = re.sub(r'src="(' + ORIGIN_URL + r')"', lambda m: 'src="' + local_asset(m.group(1)) + '"', body)
    with open(os.path.join(PARTS, name + ".body.html"), "w", encoding="utf-8") as f:
        f.write(body)
    missing = set(re.findall(class_re, style_of(html))) - known
    print(name, "body", len(body), "css-in-js classes missing from app.css:", len(missing))

print("next: run `file` on", ASSETS, "and replace every font or image that is really HTML")
