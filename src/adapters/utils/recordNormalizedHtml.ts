// src/ingest/recordRawNormalized.ts
import  prisma  from "../../db";
import { extractRelevantHtml, compressSnapshot, sha256 } from "./extractRelevantHtml";

type Meta = Record<string, unknown> | undefined;

export async function recordNormalizedHtml(
  source: string,
  url: string,
  status: number,
  rawHtml: string,
  selectors: string[] = ["body"],
  meta?: Meta
) {
  const fragment = extractRelevantHtml(rawHtml, url, selectors);      
  const compressed = compressSnapshot(fragment);
  const contentSha = sha256(fragment);
  const uniq = sha256(`${source}|${url}|${contentSha}`);

  // lightweight row
  const metaRow = await prisma.rawIngest.upsert({
    where: { uniq },
    update: {},
    create: {
      source, url, fetchedAt: new Date(), httpStatus: status,
      contentSha, meta: { ...meta, normalized: true, selectors },
      uniq,
    },
    select: { id: true },
  });

  // store bytes in child table; now they’re tiny
  await prisma.rawIngestBlob.upsert({
    where: { rawIngestId: metaRow.id },
    update: { content: compressed },
    create: { rawIngestId: metaRow.id, content: compressed },
  });
}
