"""Turn captured body parts into demo pages. Edit PAGES and REPLACEMENTS for each demo."""
import os
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(os.path.dirname(HERE), "demo")
VERSION = str(int(time.time()))

# Dev-only overlays to hide. Hide, do not cut: dialog and toast portals come after them in the body.
DEV_ONLY_CLASSES = ["tsqd-parent-container"]

# (part name, output file, page title, scripts to append). Keep today's unchanged screen as its own page.
PAGES = [
    ("01-page", "today.html", "Demo - today", ["demo-nav.js"]),
    ("01-page", "new-flow.html", "Demo - new flow", ["demo-data.js", "demo.js"]),
]

# (output file, old text, new text). One entry per Reworded row in the text register, nothing else.
REPLACEMENTS = [
    # ("new-flow.html", 'type="file"', 'type="file" multiple'),
]


def part(name):
    with open(os.path.join(HERE, "parts", name + ".body.html"), encoding="utf-8") as f:
        return f.read()


def hide_dev_only(body):
    for cls in DEV_ONLY_CLASSES:
        body = body.replace(f'class="{cls}"', f'class="{cls}" style="display: none"', 1)
    return body


def page(title, body, scripts):
    tags = "".join(f'<script src="{s}?v={VERSION}"></script>' for s in scripts)
    body = body.replace("</body></html>", tags + "</body></html>")
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f"<title>{title}</title>"
        f'<link rel="stylesheet" href="assets/app.css?v={VERSION}">'
        f'<link rel="stylesheet" href="demo.css?v={VERSION}">'
        "</head>" + body
    )


for name, out, title, scripts in PAGES:
    body = hide_dev_only(part(name))
    for target, old, new in REPLACEMENTS:
        if target != out:
            continue
        if old not in body:
            raise SystemExit(f"{out}: text not found: {old!r}")
        body = body.replace(old, new)
    with open(os.path.join(DEMO, out), "w", encoding="utf-8") as f:
        f.write(page(title, body, scripts))
    print("built", out)
