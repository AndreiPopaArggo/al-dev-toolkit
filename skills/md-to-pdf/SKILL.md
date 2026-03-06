---
name: md-to-pdf
description: Convert Markdown files to PDF with Mermaid diagram support. Use when asked to convert, export, or generate PDF from markdown files.
argument-hint: "<file.md> [options: --no-mermaid, --css <path>, --output <path>]"
disable-model-invocation: true
---

# Markdown to PDF

Convert Markdown files to PDF using a two-step pipeline: `mmdc` (Mermaid CLI) renders diagrams to SVG, then `md-to-pdf` converts the processed Markdown to PDF via Puppeteer/Chrome.

## Usage

`/md-to-pdf <file-or-glob> [options]`

Examples:
- `/md-to-pdf docs/PROJECT-DOCS.md` — convert a single file
- `/md-to-pdf docs/*.md` — convert all .md files in docs/
- `/md-to-pdf README.md --no-mermaid` — skip Mermaid preprocessing
- `/md-to-pdf docs/report.md --css ~/templates/pdf-style.css` — custom stylesheet
- `/md-to-pdf docs/report.md --output ~/Desktop/report.pdf` — custom output path

## Arguments

$ARGUMENTS

Parse the arguments:
- **File path or glob** (required): the `.md` file(s) to convert
- `--no-mermaid`: skip Mermaid preprocessing (faster if no diagrams)
- `--css <path>`: path to a CSS stylesheet for PDF styling
- `--output <path>`: custom output file path (only valid for single file input)

## Process

For each `.md` file matched:

### Step 1: Check for Mermaid blocks

Unless `--no-mermaid` is specified, check if the file contains ` ```mermaid ` code blocks:

```bash
grep -c '```mermaid' "<input-file>"
```

If count is 0 and `--no-mermaid` is not set, skip Step 2 (no diagrams to render).

### Step 2: Preprocess Mermaid diagrams

If the file contains Mermaid blocks, use `mmdc` to render them to SVG.

**CRITICAL: You must `cd` to the input file's directory first.** `mmdc` creates SVG files with relative paths (e.g., `./file.tmp-1.svg`). If you run from a different directory, the SVGs land in the wrong folder and `md-to-pdf` can't find them — diagrams render as broken image icons.

```bash
cd "<input-file-directory>"
mmdc -i "<filename>" -o "<filename>.tmp.md" --outputFormat svg
```

This creates (in the same directory as the input file):
- `<filename>.tmp.md` — Markdown with mermaid blocks replaced by `![diagram](path.svg)` references
- `<filename>.tmp-1.svg`, `<filename>.tmp-2.svg`, ... — rendered SVG files

Use the `.tmp.md` file as input for Step 3.

### Step 3: Convert to PDF

Run from the **same directory** (stay in the `cd` from Step 2):

```bash
md-to-pdf "<filename>.tmp.md" [--stylesheet "<css-path>"]
```

Where the source is either the `.tmp.md` (if Mermaid was processed) or the original `.md` file.

If `--css` was specified, pass it as `--stylesheet`.
If `--output` was specified, pass it with `--output`.

### Step 4: Clean up temp files

Remove all temporary files created by mmdc:

```bash
rm -f "<input-file>.tmp.md" "<input-file>.tmp-"*.svg
```

### Step 5: Report

Show:
- Output PDF path and file size
- Number of Mermaid diagrams rendered (if any)
- Any warnings or errors

## Error Handling

- If `mmdc` is not installed: show `npm install -g @mermaid-js/mermaid-cli` and continue without Mermaid (warn user diagrams won't render)
- If `md-to-pdf` is not installed: show `npm install -g md-to-pdf@5.2.5` and stop
- If a Mermaid diagram fails to render: warn but continue with remaining diagrams
- If PDF conversion fails: show the error output from md-to-pdf

## Notes

- **Mermaid preprocessing is automatic** — no front-matter or script injection needed
- SVG diagrams are embedded in the PDF at full quality (vector, not rasterized)
- Custom CSS supports standard CSS print rules (`@page`, `page-break-before`, margins, etc.)
- The `md-to-pdf` tool supports front-matter in the `.md` file for per-file PDF options:
  ```yaml
  ---
  pdf_options:
    format: A4
    margin: 20mm
  ---
  ```
- **Security note**: `md-to-pdf` v5.2.5 has patched known RCE vulnerabilities. Only convert trusted files — never process untrusted user-submitted Markdown.
