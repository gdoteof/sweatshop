
import { type SourceAdapter, DiscoveredItem } from "../de/types";

export abstract class BaseAdapter implements SourceAdapter {
  abstract readonly source: string;
  abstract discoverTracks(indexUrl: string): Promise<DiscoveredItem[]>;
  abstract discoverTrackDays(trackUrl: string): Promise<DiscoveredItem[]>;
  abstract discoverRaces(trackDayUrl: string): Promise<DiscoveredItem[]>;
}