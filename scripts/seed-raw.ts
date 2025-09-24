import crypto from "node:crypto";
import  prisma  from "../src/db";


async function main() {
    const big = crypto.randomBytes(8 * 1024 * 1024); // 8MB sample body
    const contentSha = crypto.createHash("sha256").update(big).digest("hex");
    const uniq = crypto.createHash("sha256").update(`SiteA|https://example.com|${contentSha}`).digest("hex");


    const metaRow = await prisma.rawIngest.upsert({
        where: { uniq },
        update: {},
        create: {
            source: "SiteA",
            url: "https://example.com",
            fetchedAt: new Date(),
            httpStatus: 200,
            contentSha,
            meta: { test: true },
            uniq,
        },
        select: { id: true },
    });


    // Store the blob in the child table (so list queries on RawIngest are light)
    await prisma.rawIngestBlob.upsert({
        where: { rawIngestId: metaRow.id },
        update: { content: big },
        create: { rawIngestId: metaRow.id, content: big },
    });


    // Verify we can read metadata without pulling the blob
    const rows = await prisma.rawIngest.findMany({ take: 5 });
    console.log("RawIngest meta rows:", rows.map(r => ({ id: r.id, url: r.url, sha: r.contentSha.slice(0, 8) })));


    // Read blob only when needed
    const blob = await prisma.rawIngestBlob.findUnique({ where: { rawIngestId: metaRow.id }, select: { content: true } });
    console.log("Blob length:", blob?.content?.length);
}


main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });