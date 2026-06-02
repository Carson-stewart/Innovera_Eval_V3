import mammoth from "mammoth";

export class UnsupportedFileTypeError extends Error {
  constructor(public readonly ext: string) {
    super(`Unsupported file type: ${ext}`);
    this.name = "UnsupportedFileTypeError";
  }
}

// ─── docx → markdown-ish conversion ──────────────────────────────────────────
// mammoth.extractRawText strips ALL structure: Word "Heading 1" styles become
// bare text lines, so splitChapters() sees no `#` headings and collapses the
// whole memo into a single "Full Memo" chapter. That broke per-chapter scoring
// granularity AND the redundancy diagnostic (false 0.0% SRI) on docx inputs.
//
// Fix: convertToHtml preserves heading levels (Heading 1 → <h1>, etc.); we then
// deterministically map h1–h6 → markdown `#` headings and flatten everything
// else to plain text. The result feeds the SAME canonical splitChapters() that
// .md memos use — docx and md now segment identically.

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)));
}

/** Strip any tags inside an element's inner HTML and decode entities. */
function innerText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function htmlToMarkdown(html: string): string {
  let md = html
    // line breaks first
    .replace(/<br\s*\/?>/gi, "\n")
    // headings → markdown # levels (the critical structural mapping)
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) =>
      `\n\n${"#".repeat(Number(lvl))} ${innerText(inner)}\n\n`)
    // list items → bullets
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `- ${innerText(inner)}\n`)
    // table cells → one line each (matches extractRawText's cell-per-line shape)
    .replace(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag: string, inner: string) =>
      `${innerText(inner)}\n\n`)
    // paragraphs → blank-line-separated text
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner: string) => `${innerText(inner)}\n\n`)
    // strip whatever tags remain (table/tr/ul/ol wrappers etc.)
    .replace(/<[^>]+>/g, "");

  md = decodeEntities(md);

  // Collapse 3+ consecutive newlines to exactly 2
  return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export async function parseFile(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".docx")) {
    // Structure-preserving conversion (NOT extractRawText — see comment above).
    const result = await mammoth.convertToHtml({ buffer });
    return htmlToMarkdown(result.value);
  }

  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  const ext = lower.split(".").pop() ?? "unknown";
  throw new UnsupportedFileTypeError(ext);
}
