import { join } from "path";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface ExtractedPage {
  pageNumber: number;
  lines: string[];
}

/**
 * Thrown when the PDF is encrypted but no password (or a wrong password)
 * was supplied. Distinct from generic parse errors so the API layer can
 * route it to a friendly "this PDF is locked, enter the PIN" message.
 */
export class PasswordRequiredError extends Error {
  /** True when the user provided no password at all; false when wrong PIN. */
  readonly missing: boolean;
  constructor(opts: { missing: boolean; cause?: unknown }) {
    super(
      opts.missing
        ? "PDF is password-protected but no password was supplied"
        : "PDF password is incorrect"
    );
    this.name = "PasswordRequiredError";
    this.missing = opts.missing;
    if (opts.cause) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export async function decryptAndExtractText(
  pdfBuffer: Buffer,
  password?: string | null
): Promise<ExtractedPage[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Set worker source to the absolute file path
  // serverExternalPackages ensures this runs as native Node.js (not bundled)
  pdfjsLib.GlobalWorkerOptions.workerSrc = join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );

  const data = new Uint8Array(pdfBuffer);

  // Only pass `password` to pdfjs when one was actually provided. pdfjs
  // happily opens unencrypted PDFs without a password, and giving it an
  // empty string can change its error semantics.
  const trimmed = (password ?? "").trim();
  const loadingTask = pdfjsLib.getDocument({
    data,
    ...(trimmed ? { password: trimmed } : {}),
    useSystemFonts: true,
  });

  let doc: Awaited<typeof loadingTask.promise>;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    // Convert pdfjs's password exceptions into our own typed error so the
    // API layer can give the user the right next step. pdfjs uses string
    // names rather than instanceof checks across realms, hence the duck-
    // typing here.
    const name = (err as { name?: string } | null)?.name ?? "";
    const message = String((err as { message?: string } | null)?.message ?? "");
    const looksLikePassword =
      name === "PasswordException" ||
      /password/i.test(message);
    if (looksLikePassword) {
      throw new PasswordRequiredError({ missing: !trimmed, cause: err });
    }
    throw err;
  }
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items.filter(
      (item): item is TextItem => "str" in item
    );

    const lineMap = new Map<number, { x: number; str: string }[]>();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x: item.transform[4], str: item.str });
    }

    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    const lines: string[] = [];

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      const line = lineItems.map((item) => item.str).join(" ").trim();
      if (line) lines.push(line);
    }

    pages.push({ pageNumber: i, lines });
  }

  await doc.destroy();

  try {
    data.fill(0);
  } catch {
    // Buffer may already be detached by pdfjs
  }

  return pages;
}
