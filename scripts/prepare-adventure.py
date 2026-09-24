"""Extract privately held PDF text, optionally OCR scanned pages, without publishing it.

Dependencies: pymupdf; add rapidocr and onnxruntime for --ocr.
All output is written below .local/adventures unless another private folder is chosen.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import pymupdf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--ocr", action="store_true")
    parser.add_argument("--output", type=Path, default=Path(".local/adventures"))
    parser.add_argument("--pages", help="Optional 1-based inclusive range, e.g. 7-38")
    args = parser.parse_args()
    doc = pymupdf.open(args.pdf)
    slug = re.sub(r"[^a-z0-9]+", "-", args.pdf.stem.lower()).strip("-")
    destination = args.output / slug
    destination.mkdir(parents=True, exist_ok=True)
    selected = list(range(len(doc)))
    if args.pages:
        first, last = map(int, args.pages.split("-"))
        if first < 1 or last > len(doc) or last < first:
            raise ValueError("Page range is outside this PDF")
        selected = list(range(first - 1, last))
    engine = None
    report = {"source": args.pdf.name, "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(), "pages": []}
    sections = []
    for index in selected:
        page = doc[index]
        text = page.get_text(sort=True).strip()
        method = "embedded text"
        confidence = None
        cache = destination / f"page-{index + 1:03}.json"
        if len(text) < 80 and args.ocr:
            if cache.exists():
                cached = json.loads(cache.read_text(encoding="utf-8"))
                if cached.get("sourceSha256") == report["sha256"]:
                    text, confidence = cached["text"], cached.get("confidence")
            if len(text) < 80:
                if engine is None:
                    from rapidocr import RapidOCR
                    engine = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 4, "EngineConfig.onnxruntime.inter_op_num_threads": 1})
                # Column crops preserve reading order in the two-column rulebook layouts.
                lines, scores = [], []
                for left, right in [(0, 0.5), (0.5, 1)]:
                    rect = pymupdf.Rect(page.rect.width * left, 0, page.rect.width * right, page.rect.height)
                    result = engine(page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=rect).tobytes("png"))
                    if result.txts:
                        lines.extend(result.txts)
                        scores.extend(float(s) for s in result.scores)
                text = "\n".join(lines)
                confidence = sum(scores) / len(scores) if scores else 0
            method = "OCR; manual review required"
        cache.write_text(json.dumps({"sourceSha256": report["sha256"], "pdfPage": index + 1, "text": text, "confidence": confidence}, ensure_ascii=False, indent=2), encoding="utf-8")
        report["pages"].append({"pdfPage": index + 1, "characters": len(text), "method": method, "confidence": confidence, "reviewRequired": True})
        sections.append(f"\n## Source PDF page {index + 1}\n\n{text}\n")
        print(f"Page {index + 1}/{len(doc)}: {len(text)} characters ({method})", flush=True)
    # Markdown is supported by DoR's source reader and fits its file-size limit.
    title = f"# {args.pdf.stem}\n\nPrivate extraction. Verify OCR and dice symbols against the original PDF.\n"
    (destination / f"{slug}.md").write_text(title + "\n".join(sections), encoding="utf-8")
    (destination / "intake-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Prepared {len(selected)} pages in {destination}", flush=True)


if __name__ == "__main__":
    main()
