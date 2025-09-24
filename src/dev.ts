
import { ScrapeService as _unused } from "./services/restated"; // ensures service boot in dev
import { SiteAAdapter } from "./adapters/example";
import { Indexer } from "./indexer";
import  prisma  from "./db";
import { log } from "./log";
import { FanOddsAdapter } from "./adapters/fanOdds";
import { fanoddsScrapeDay, scrapeAndSaveRaceResults } from "./adapters/fanoddsParser";

async function main() {
  const A = new FanOddsAdapter();
  const indexUrls = [process.env.FANODDS_INDEX_URL || "https://www.fanodds.com/us/horse-racing/results"];

  const data = await scrapeAndSaveRaceResults('https://www.fanodds.com/us/horse-racing/results/durbanville/2025-09-22');
  log.info({ data }, "sample scrape");
  // 1) Seed tracks from index
  await Indexer.addTracks(A, indexUrls);

  // 2) Pull a batch of track targets and discover days
  const tracks = await prisma.crawlTarget.findMany({ where: { source: A.source, kind: "track", status: "pending" }, take: 10 });
  for (const t of tracks) {
    await Indexer.addTrackDay(A, t.id);
  }

  // 3) Pull a batch of track-day targets and discover races
  const tds = await prisma.crawlTarget.findMany({ where: { source: A.source, kind: "track-day", status: "pending" }, take: 10 });
  for (const td of tds) {
    await Indexer.addRaces(A, td.id);
  }

  log.info("dev seed pass complete");
}

main().catch((e) => {
  log.error(e, "dev run failed");
  process.exit(1);
});