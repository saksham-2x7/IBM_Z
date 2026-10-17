"""Render docs/whitepaper.md to docs/AuraZ_Whitepaper.pdf with headless Chrome (no Python dependencies).
    python3 scripts/build_pdf.py
Handles the Markdown subset the whitepaper uses: headings, paragraphs, bold/italic/code, tables, lists.
"""
import html, os, re, subprocess, sys, tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC, OUT = os.path.join(ROOT, "docs", "whitepaper.md"), os.path.join(ROOT, "docs", "AuraZ_Whitepaper.pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![*\w])\*([^*]+)\*(?!\w)", r"<i>\1</i>", s)
    return s

def convert(md):
    out, lines, i = [], md.splitlines(), 0
    while i < len(lines):
        l = lines[i]
        if not l.strip(): i += 1; continue
        m = re.match(r"(#{1,3}) (.*)", l)
        if m:
            out.append(f"<h{len(m.group(1))}>{inline(m.group(2))}</h{len(m.group(1))}>"); i += 1; continue
        if l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells): rows.append(cells)
                i += 1
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in rows[0]) + "</tr></thead><tbody>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows[1:]) + "</tbody></table>")
            continue
        if re.match(r"(\d+\.|-) ", l):
            tag = "ol" if l[0].isdigit() else "ul"; items = []
            while i < len(lines) and re.match(r"(\d+\.|-) ", lines[i]):
                items.append(re.sub(r"^(\d+\.|-) ", "", lines[i])); i += 1
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>"); continue
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r"(#{1,3} |\||\d+\. |- )", lines[i]):
            para.append(lines[i]); i += 1
        out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)

CSS = """
@page { size: A4; margin: 16mm 15mm; }
body { font: 10pt/1.42 -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a1d24; }
h1 { font-size: 17pt; margin: 0 0 4pt; color: #0b3a53; }
h2 { font-size: 12pt; margin: 12pt 0 4pt; color: #0b3a53; border-bottom: 1px solid #d6dde4; padding-bottom: 2pt; }
p, li { margin: 3pt 0; } ul, ol { margin: 3pt 0 3pt 16pt; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 5pt 0 7pt; font-size: 9pt; }
th, td { border: 1px solid #cfd7df; padding: 3pt 5pt; text-align: left; vertical-align: top; }
th { background: #eef3f7; }
code { font: 8.6pt Menlo, monospace; background: #f1f4f7; padding: 0 2pt; border-radius: 2px; }
"""

def main():
    body = convert(open(SRC).read())
    doc = f"<!doctype html><html><head><meta charset='utf-8'><title>AuraZ Whitepaper</title><style>{CSS}</style></head><body>{body}</body></html>"
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(doc); tmp = f.name
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={OUT}", f"file://{tmp}"],
                   check=True, capture_output=True, timeout=120)
    os.unlink(tmp)
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")

if __name__ == "__main__":
    sys.exit(main())
