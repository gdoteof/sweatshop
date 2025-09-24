import { z } from "zod";


export const CrawlKind = z.enum(["index", "track", "track-day", "race"]);
export type CrawlKind = z.infer<typeof CrawlKind>;


export const DiscoveredItem = z.object({
  kind: CrawlKind,
  url: z.string().url(),
  // Optional metadata that adapters can pass downstream
  meta: z.record(z.string(), z.any()).optional(),
});
export type DiscoveredItem = z.infer<typeof DiscoveredItem>;


// Adapter contract
export interface SourceAdapter {
  /** Unique key e.g. "SiteA" */
  readonly source: string;
  /**
  * From an index (hub) URL, discover track pages.
  * Must be idempotent: never mutate; just return links.
  */
  discoverTracks(indexUrl: string): Promise<DiscoveredItem[]>;
  /** From a track page, discover track-day result pages. */
  discoverTrackDays(trackUrl: string): Promise<DiscoveredItem[]>;
  /** From a track-day page, discover race result pages (or anchors). */
  discoverRaces(trackDayUrl: string): Promise<DiscoveredItem[]>;
}

export type RaceScrapeInfo = {
  track: string;
  date: string;
};

export type ScrapeRequest = {
  url: string;
  raceInfo: RaceScrapeInfo;
}

export type RaceResultRow = {
  position: number;
  horse: string;
  jockey: string;
  trainer: string;
  raceTime: {
    minutes: number;
    seconds: number;
    milliseconds: number;
  } | null;
  money: number;
}

export type RaceConditions = {
  time: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  surface: string;
  speed: "fast" | "slow" | "moderate" | null;
}

export type RaceResult = {
  results: RaceResultRow[];
  raceNumber: number;
  raceConditions: RaceConditions;
};

export type ScrapeResult = {
  raceInfo: RaceScrapeInfo;
  raceResults: RaceResult[];
}

export interface SourceAdapter {
  /** Unique key e.g. "SiteA" */
  readonly source: string;
  /**
   * From an index (hub) URL, discover track pages.
   * Must be idempotent: never mutate; just return links.
   */
  discoverTracks(indexUrl: string): Promise<DiscoveredItem[]>;
  /** From a track page, discover track-day result pages. */
  discoverTrackDays(trackUrl: string): Promise<DiscoveredItem[]>;
  /** From a track-day page, discover race result pages (or anchors). */
  discoverRaces(trackDayUrl: string): Promise<DiscoveredItem[]>;
}