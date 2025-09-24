
import { BaseAdapter } from "./base";
import { DiscoveredItem } from "../de/types";
import { limitedFetch, recordRaw } from "../http";
import * as cheerio from "cheerio";
import { log } from "../log";
import { ur } from "zod/locales";

export class FanOddsAdapter extends BaseAdapter {
  readonly source = "fanodds.com" as const;

  async discoverTracks(indexUrl: string): Promise<DiscoveredItem[]> {
    // https://www.fanodds.com/us/horse-racing/results
    const res = await limitedFetch(indexUrl);
    await recordRaw(this.source, indexUrl, res.status, res.body, { phase: "discoverTracks" });
    const $ = cheerio.load(res.body.toString("utf8"));

    // Example: anchors under #tracks a[href]
    const items: DiscoveredItem[] = [];
    $(".base-card a[href]").each((_, el) => {
      const url = new URL($(el).attr("href")!, indexUrl).toString().split('#')[0];
      if (url.includes("horse-racing/results")) items.push({ kind: "track", url });
      // items.push({ kind: "track", url });
      log.info({ url }, "FanOdds track discovered");
    });
    return items;
  }

  async discoverTrackDays(trackUrl: string): Promise<DiscoveredItem[]> {
    const res = await limitedFetch(trackUrl);
    await recordRaw(this.source, trackUrl, res.status, res.body, { phase: "discoverTrackDays" });
    const $ = cheerio.load(res.body.toString("utf8"));

    // Example: pagination or list of dates
    const items: DiscoveredItem[] = [];
    $(".day-list a[href]").each((_, el) => {
      const url = new URL($(el).attr("href")!, trackUrl).toString().split('#')[0];
      items.push({ kind: "track-day", url });
    });

    // If there is pagination, follow next links lazily: callers can requeue these URLs
    const nextHref = $("a.next").attr("href");
    if (nextHref) {
      items.push({ kind: "track-day", url: new URL(nextHref, trackUrl).toString(), meta: { pagination: true } });
    }

    return items;
  }

  async discoverRaces(trackDayUrl: string): Promise<DiscoveredItem[]> {
    const res = await limitedFetch(trackDayUrl);
    await recordRaw(this.source, trackDayUrl, res.status, res.body, { phase: "discoverRaces" });
    const $ = cheerio.load(res.body.toString("utf8"));

    const items: DiscoveredItem[] = [];
    // Example A: one page per race
    $(".race-list a[href]").each((_, el) => {
      const url = new URL($(el).attr("href")!, trackDayUrl).toString().split('#')[0];

      items.push({ kind: "race", url });
    });

    // Example B: single page with anchors (#race-1, #race-2)
    if (items.length === 0) {
      $("section[id^='race-']").each((_, el) => {
        const id = (el.attribs?.id ?? "").trim();
        if (id) items.push({ kind: "race", url: `${trackDayUrl}#${id}` });
      });
    }

    return items;
  }
}