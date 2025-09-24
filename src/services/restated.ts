
import * as restate from "@restatedev/restate-sdk";
import { Indexer } from "../indexer";
import { SiteAAdapter } from "../adapters/example";
import  prisma  from "../db";
import { log } from "../log";

const A = new SiteAAdapter();

type AddTracksReq = { indexUrls: string[] };

type AddTrackDayReq = { source: string; trackTargetId: string };

type AddRacesReq = { source: string; trackDayTargetId: string };

export const ScrapeService = restate.service({
  name: "ScrapeService",
  handlers: {
    AddTracks: async (ctx: restate.Context, req: AddTracksReq) => {
      const kid = ctx.rand.uuidv4();
      log.info({ kid, req }, "AddTracks start");
      await Indexer.addTracks(A, req.indexUrls);
      log.info({ kid }, "AddTracks done");
    },
    AddTrackDay: async (_ctx: restate.Context, req: AddTrackDayReq) => {
      if (req.source !== A.source) throw new Error("unknown source");
      await Indexer.addTrackDay(A, BigInt(req.trackTargetId));
    },
    AddRaces: async (_ctx: restate.Context, req: AddRacesReq) => {
      if (req.source !== A.source) throw new Error("unknown source");
      await Indexer.addRaces(A, BigInt(req.trackDayTargetId));
    },
    // Helper: get pending targets of a given kind to fan out jobs
    GetPending: async (_ctx: restate.Context, req: { source: string; kind: string; limit?: number }) => {
      const rows = await prisma.crawlTarget.findMany({
        where: { source: req.source, kind: req.kind, status: "pending" },
        take: Math.min(req.limit ?? 100, 500),
        orderBy: { id: "asc" },
      });
      return rows.map((r) => ({ id: String(r.id), url: r.url, parentId: r.parentId ? String(r.parentId) : null }));
    },
  },
});

restate.serve({ services: [ScrapeService], port: Number(process.env.PORT || 9080) });