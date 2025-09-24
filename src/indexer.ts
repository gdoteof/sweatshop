
import { DiscoveredItem, type SourceAdapter, CrawlKind } from "./de/types";
import  prisma  from "./db";
import { log } from "./log";

function dedupeKey(source: string, item: DiscoveredItem, parentId?: bigint) {
  return `${source}|${item.kind}|${item.url}|${parentId ?? "root"}`;
}

export async function upsertCrawlTargets(
  source: string,
  items: DiscoveredItem[],
  parentId?: bigint
) {
  if (!items.length) return { created: 0, existing: 0 };
  let created = 0;
  let existing = 0;
  for (const item of items) {
    const key = dedupeKey(source, item, parentId);
    try {
      log.info({ source, item, parentId, key }, "upsertCrawlTargets");
      await prisma.crawlTarget.create({
        data: {
          source,
          kind: item.kind,
          url: item.url,
          parentId: parentId ?? null,
          dedupeKey: key,
          status: "pending",
        },
      });
      created++;
    } catch (e: any) {
      if (String(e.message).includes("Unique constraint failed")) {
        existing++;
      } else {
        throw e;
      }
    }
  }
  log.info({ source, created, existing }, "crawl targets upserted");
  return { created, existing };
}

export async function markTarget(
  id: bigint,
  updates: Partial<{ status: string; lastError: string | null }>
) {
  log.info({ id, updates }, "markTarget");
  await prisma.crawlTarget.update({
    where: { id },
    data: { ...updates },
  });
}

// Orchestrators: AddTracks → AddTrackDay → AddRaces
export const Indexer = {
  // AddTracks: from adapter index URLs (one or many) discover track pages
  async addTracks(adapter: SourceAdapter, indexUrls: string[]) {
    log.info({ source: adapter.source, indexUrls }, "Indexer.addTracks start");
    for (const url of indexUrls) {
      const parent = await ensureRootTarget(adapter.source, url);
      await markTarget(parent.id, { status: "processing", lastError: null });
      try {
        const discovered = await adapter.discoverTracks(url);
        // Force kind to 'track' regardless of adapter return kind errors
        const items = discovered.map((d) => ({ ...d, kind: "track" as CrawlKind }));
        await upsertCrawlTargets(adapter.source, items, parent.id);
        await markTarget(parent.id, { status: "done" });
      } catch (err: any) {
        await markTarget(parent.id, { status: "error", lastError: String(err) });
      }
    }
  },

  // AddTrackDay: take pending 'track' targets, discover 'track-day' targets
  async addTrackDay(adapter: SourceAdapter, trackTargetId: bigint) {
    const trackTarget = await prisma.crawlTarget.findUnique({ where: { id: trackTargetId } });
    if (!trackTarget || trackTarget.kind !== "track") throw new Error("bad track target");
    await markTarget(trackTarget.id, { status: "processing", lastError: null });
    try {
      const items = await adapter.discoverTrackDays(trackTarget.url);
      const normalized = items.map((d) => ({ ...d, kind: "track-day" as CrawlKind }));
      await upsertCrawlTargets(adapter.source, normalized, trackTarget.id);
      await markTarget(trackTarget.id, { status: "done" });
    } catch (err: any) {
      await markTarget(trackTarget.id, { status: "error", lastError: String(err) });
    }
  },

  // AddRaces: for a given 'track-day', discover 'race' targets
  async addRaces(adapter: SourceAdapter, trackDayTargetId: bigint) {
    const td = await prisma.crawlTarget.findUnique({ where: { id: trackDayTargetId } });
    if (!td || td.kind !== "track-day") throw new Error("bad track-day target");
    await markTarget(td.id, { status: "processing", lastError: null });
    try {
      const items = await adapter.discoverRaces(td.url);
      const normalized = items.map((d) => ({ ...d, kind: "race" as CrawlKind }));
      await upsertCrawlTargets(adapter.source, normalized, td.id);
      await markTarget(td.id, { status: "done" });
    } catch (err: any) {
      await markTarget(td.id, { status: "error", lastError: String(err) });
    }
  },
};

async function ensureRootTarget(source: string, indexUrl: string) {
  const key = `${source}|index|${indexUrl}|root`;
  log.info({ source, indexUrl }, "ensureRootTarget");
  const existing = await prisma.crawlTarget.findUnique({ where: { dedupeKey: key } });
  if (existing) return existing;
  return prisma.crawlTarget.create({
    data: { source, kind: "index", url: indexUrl, dedupeKey: key, status: "pending" },
  });
}