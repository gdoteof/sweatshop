import * as cheerio from "cheerio";
import zlib from "node:zlib";
import crypto from "node:crypto";

/** Keep only nodes that match selectors. Everything else is dropped. */
export function extractRelevantHtml(rawHtml: string, baseUrl: string, selectors: string[] = ["body"]): string {
  const $ = cheerio.load(rawHtml);

  // Remove heavy noise early
  $("script, style, noscript, link[rel='preload'], link[rel='modulepreload'], iframe, img, video, audio, canvas").remove();

  // Build a minimal document containing only matched nodes (and their minimal parents)
  const frag = cheerio.load("<!doctype html><html><head></head><body></body></html>");
  const $f = frag.load(frag.html());

  const body = $f("body");
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const clone = $(el).clone();

      // Normalize attributes: keep only href/src, make them absolute
      clone.find("*").addBack().each((__, node) => {
        const attribs = (node as any).attribs || {};
        for (const name of Object.keys(attribs)) {
          if (!["href", "src"].includes(name)) {
            (node as any).attribs && delete (node as any).attribs[name];
          }
        }
        // absolutize href/src
        const href = (node as any).attribs?.href;
        if (href) (node as any).attribs.href = new URL(href, baseUrl).toString();
        const src = (node as any).attribs?.src;
        if (src) (node as any).attribs.src = new URL(src, baseUrl).toString();
      });

      body.append(clone);
    });
  }

  // Collapse whitespace & remove comments
  $f("*").each((_, el) => {
    const node = $f(el);
    const txt = node.text().replace(/\s+/g, " ").trim();
    if (txt) node.text(txt);
  });
  $f.root().contents().each((_, n) => {
    if (n.type === "comment") $f(n).remove();
  });

  // Return tiny HTML fragment (body contents only)
  return body.html() || "";
}

/** Brotli-compress with sane defaults; fall back to gzip if needed. */
export function compressSnapshot(html: string): Buffer {
  try {
    return zlib.brotliCompressSync(Buffer.from(html, "utf8"), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 },
    });
  } catch {
    return zlib.gzipSync(Buffer.from(html, "utf8"), { level: 6 });
  }
}

export function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
