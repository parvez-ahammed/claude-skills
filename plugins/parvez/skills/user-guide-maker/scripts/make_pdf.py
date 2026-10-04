"""Print a guide HTML to PDF with headless Chrome or Edge, then report how full each page is.

Usage: python make_pdf.py <guide.html> <out.pdf>
Needs PyMuPDF (pip install pymupdf). Set CHROME_PATH if Chrome/Edge is not found.
A page that ends far above the bottom (under about 80%) usually means a heading was left
alone or a card jumped to the next page. Fix the print CSS, then run this again.
"""
import os
import pathlib
import shutil
import subprocess
import sys

import fitz  # PyMuPDF, so no poppler (pdftoppm) install is needed

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]


def find_browser():
    if os.environ.get("CHROME_PATH"):
        return os.environ["CHROME_PATH"]
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome", "msedge"):
        if shutil.which(name):
            return shutil.which(name)
    for path in CANDIDATES:
        if pathlib.Path(path).exists():
            return path
    sys.exit("No Chrome or Edge found. Set CHROME_PATH.")


html, pdf = (pathlib.Path(p).resolve() for p in sys.argv[1:3])
subprocess.run(
    [find_browser(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
     f"--print-to-pdf={pdf}", html.as_uri()],
    capture_output=True,
)
if not pdf.exists():
    sys.exit(f"Chrome did not write {pdf}.")

doc = fitz.open(pdf)
print(f"{pdf.name}: {doc.page_count} pages, {pdf.stat().st_size // 1024} KB")
for index, page in enumerate(doc):
    blocks = [b for b in page.get_text("blocks") if b[4].strip()]
    if not blocks:
        print(f"  page {index + 1}: EMPTY")
        continue
    filled = max(b[3] for b in blocks) / page.rect.height
    last = blocks[-1][4].strip().replace("\n", " ")[:60]
    flag = "  <-- check" if filled < 0.8 and index < doc.page_count - 1 else ""
    print(f"  page {index + 1}: {filled:4.0%} full, ends with: {last}{flag}")

for index in range(min(doc.page_count, 12)):
    doc[index].get_pixmap(dpi=55).save(str(pdf.with_name(f"{pdf.stem}.page{index + 1}.png")))
print("previews:", pdf.with_name(f"{pdf.stem}.page<N>.png"), "(delete them when done)")
