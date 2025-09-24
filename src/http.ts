import Bottleneck from "bottleneck";
import { request } from "undici";
import crypto from "node:crypto";
import prisma from "./db";
import { log } from "./log"
import { extractRelevantHtml } from "./adapters/utils/extractRelevantHtml";


const limiter = new Bottleneck({
    minTime: Number(process.env.MIN_REQUEST_MS || 250),
    maxConcurrent: Number(process.env.MAX_CONCURRENCY || 8),
});


export type FetchResult = {
    url: string;
    status: number;
    body: Buffer;
    headers: Record<string, string>;
};

type Meta = Record<string, any> | undefined;
export async function limitedFetch(url: string): Promise<FetchResult> {
    return limiter.schedule(async () => {
        for (let attempt = 1; attempt <= 4; attempt++) {
            try {
                const res = await request(url, {
                    method: "GET",
                    headers: { "user-agent": "horse-crawler/1.0" },
                });
                const body = Buffer.from(await res.body.arrayBuffer());
                const headers: Record<string, string> = {};
                for (const [k, v] of Object.entries(res.headers)) headers[k] = String(v);
                return { url, status: res.statusCode, body, headers };
            } catch (err) {
                const backoff = 250 * Math.pow(2, attempt - 1);
                log.warn({ err, url, attempt }, "fetch failed; retrying");
                await new Promise((r) => setTimeout(r, backoff));
            }
        }
        throw new Error(`Failed to fetch after retries: ${url}`);
    });
}


// RawIngest write (append-only, idempotent via uniq sha)
export async function recordRaw(source: string, urlUnsanitized: string, status: number, body: Buffer, meta?: Meta) {
    // remove fragments
    const url = new URL(urlUnsanitized.split("#")[0]).toString();
    const contentSha = crypto.createHash("sha256").update(body).digest("hex");
    const uniq = crypto.createHash("sha256").update(`${source}|${url}|${contentSha}`).digest("hex");


    const relevantHtml = extractRelevantHtml(body.toString("utf8"), url);
    const relevantHtmlBuffer = Buffer.from(relevantHtml, "utf8");
    log.info({ relevantHtmlBufferLength: relevantHtmlBuffer.length , bodyLength: body.length });
    // 1) Upsert metadata row (no blob)
    const metaRow = await prisma.rawIngest.upsert({
        where: { uniq },
        update: {},
        create: {
            source,
            url,
            fetchedAt: new Date(),
            httpStatus: status,
            contentSha,
            meta,
            uniq,
        },
        select: { id: true },
    });


    // 2) Upsert blob row (separate table prevents accidental full-table blob scans)
    await prisma.rawIngestBlob.upsert({
        where: { rawIngestId: metaRow.id },
        update: { content: Buffer.from(relevantHtml, "utf8") },
        create: { rawIngestId: metaRow.id, content: body },
    });
}