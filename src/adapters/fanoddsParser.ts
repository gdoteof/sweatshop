import * as cheerio from "cheerio";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(tz);


export interface RaceScrapeInfo {
    track: string;
    date: string;
}

export interface RaceResultRow {
    position: number;
    horse: string;
    jockey: string;
    trainer: string;
    raceTime: { minutes: number; seconds: number; milliseconds: number } | null;
    money: number;
}

export interface RaceConditions {
    time: number | null;
    temperature: number;
    humidity: number;
    windSpeed: number;
    surface: string;
    speed: "fast" | "slow" | "moderate" | null;
    distanceM: number;
}

export interface RaceResult {
    raceNumber: number;
    raceConditions: RaceConditions;
    results: RaceResultRow[];
}

export interface ScrapeResult {
    raceInfo: RaceScrapeInfo;
    raceResults: RaceResult[];
}

// Use the native fetch API exposed by Node.js (v18+) or fall back to undici's fetch. Note
// that undici is listed as an optional dependency; if it isn't installed,
// ensure that your runtime provides `fetch` globally.
import { fetch as undiciFetch } from "undici";
import prisma from "../db";
import { parseTrackLengthToMeters } from "./parseTrackLength";
const nodeFetch: typeof fetch = (globalThis as any).fetch ?? undiciFetch;

/*
 * Adapter for scraping race results from the Fan Odds site.
 *
 * The Fan Odds results pages follow a fairly consistent structure. Each day's card
 * contains one or more events (races) within a wrapper div with the
 * `result-events-single` class. Inside that wrapper you'll find a header
 * describing the race – including the race number and name (e.g. “R1 - St
 * Plaisir Handicap”), along with a collection of “event tools” items that
 * show the time of day, temperature, distance and surface. Immediately
 * following the header there is a table (`.result-events-table`) whose
 * `tbody` contains one row per finisher. Each row has labelled cells for
 * position, horse (and post position), rating, career record, last six
 * results, prize money, win/place/show percentages and odds.
 *
 * This adapter pulls the page over HTTP, parses it with cheerio, and
 * normalises the data into our common `ScrapeResult` shape. Only the
 * information that fits our domain model is extracted: race number, race
 * name, course surface, temperature and, for each finisher, the finishing
 * position, horse name, trainer, jockey and prize money. Other columns
 * (rating, career, last six, win/place/show percentages and odds) are
 * ignored but could be added if the domain model evolves.
 */

/**
 * Convert a prize money string like "$19K" into a number of dollars.
 * Supports suffixes K (thousands) and M (millions). Returns 0 when
 * conversion fails.
 */
function parsePrizeMoney(moneyText: string): number {
    if (!moneyText) return 0;
    const clean = moneyText.replace(/[^0-9\.KMkm]/g, "").toUpperCase();
    const multiplier = clean.includes("M") ? 1_000_000 : clean.includes("K") ? 1_000 : 1;
    const numeric = parseFloat(clean.replace(/[MK]/, ""));
    return isNaN(numeric) ? 0 : Math.round(numeric * multiplier);
}

/**
 * Extract the horse name from a string like "4.Jazira (1)". If the
 * structure does not match the expected pattern, the entire string is
 * returned.
 */
function extractHorseName(raw: string): string {
    const trimmed = raw.trim();
    const match = trimmed.match(/^[0-9]+\.\s*([^()]+?)\s*\([^)]*\)$/);
    return match ? match[1].trim() : trimmed;
}

/**
 * Parse the results page at the given Fan Odds URL and return a
 * ScrapeResult. Note that the url must point at a single day’s results for
 * a single track (e.g. `https://www.fanodds.com/us/horse-racing/results/vichy-fr/2025-08-05`).
 */
export async function fanoddsScrapeDay(url: string): Promise<ScrapeResult> {
    const res = await nodeFetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // Derive the track and date from the URL itself, falling back to page
    // content if available. The Fan Odds URL contains the track slug and the
    // date in YYYY-MM-DD format. Example: `/results/vichy-fr/2025-08-05`.
    const parts = url.split("/").filter(Boolean);
    const datePart = parts[parts.length - 1];
    const trackSlug = parts[parts.length - 2] || "";
    const trackName = trackSlug
        .split("-")
        .slice(0, 1)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");

    const raceInfo: RaceScrapeInfo = { track: trackName, date: datePart };
    const raceResults: RaceResult[] = [];

    // Each race is contained within a div.result-events-single[data-event-number]
    $("div.result-events-single[data-event-number]").each((_, elem) => {
        const eventNumberAttr = $(elem).attr("data-event-number");
        const raceNumber = eventNumberAttr ? parseInt(eventNumberAttr) : NaN;
        if (!raceNumber || isNaN(raceNumber)) return;

        // Extract header text: e.g. “R1 - St Plaisir Handicap”
        const headerText = $(elem)
            .find(".common-event-header__name")
            .first()
            .text()
            .trim();
        // Race name sits after the dash
        const dashIndex = headerText.indexOf("-");
        const raceName = dashIndex !== -1 ? headerText.slice(dashIndex + 1).trim() : headerText;

        const headerItems = $(elem).find(".result-events-single__header.common-event-tools__item");


        // Parse event tools: time-of-day (ignored), temperature, distance and surface
        const tools = $(elem).find(".common-event-tools__item");
        const temperatureText = $(tools[1]).find("span").last().text().trim();
        const distanceText = $(tools[2]).find("span").last().text().trim();
        const distanceM = parseTrackLengthToMeters(distanceText);
        const surface = $(tools[3]).find("span").last().text().trim();
        const temperatureMatch = temperatureText.match(/([0-9]+)\s*°?F/i);
        const temperature = temperatureMatch ? parseInt(temperatureMatch[1], 10) : 0;
        const raceConditions: RaceConditions = {
            time: 0,
            temperature,
            humidity: 0,
            windSpeed: 0,
            surface,
            distanceM,
            speed: null,
        };

        // Collect finisher rows
        const finishers: RaceResultRow[] = [];
        $(elem)
            .find("table.result-events-table tbody tr.result-event-single-row")
            .each((__, row) => {
                const positionText = $(row)
                    .find(".result-event-single-row--position")
                    .text()
                    .trim();
                const positionMatch = positionText.match(/([0-9]+)/);
                const position = positionMatch ? parseInt(positionMatch[1], 10) : 0;

                // Extract horse name and post position
                const competitorText = $(row)
                    .find(".common-selection-info__competitor-name")
                    .text()
                    .trim();
                const horse = extractHorseName(competitorText);

                // Trainer and jockey appear in order within .common-selection-info__stats
                let trainer = "";
                let jockey = "";
                $(row)
                    .find(".common-selection-info__stats__item")
                    .each((___, statEl) => {
                        const statText = $(statEl).text().trim();
                        if (statText.startsWith("T:")) {
                            trainer = statText.replace(/^T:\s*/, "").trim();
                        } else if (statText.startsWith("J:")) {
                            // Remove weight in parentheses
                            const raw = statText.replace(/^J:\s*/, "").trim();
                            jockey = raw.replace(/\([^)]*\)/, "").trim();
                        }
                    });

                const prizeText = $(row)
                    .find(".result-event-single-row--prizeMoney")
                    .text()
                    .trim();
                const money = parsePrizeMoney(prizeText);

                const finisher: RaceResultRow = {
                    position,
                    horse,
                    jockey,
                    trainer,
                    raceTime: null,
                    money,
                };
                finishers.push(finisher);
            });

        raceResults.push({ raceNumber, raceConditions, results: finishers });
    });

    return { raceInfo, raceResults };
}

export async function scrapeAndSaveRaceResults(url: string) {
  const data = await fanoddsScrapeDay(url);

  // 1) Track upsert by (source, name) -> input is `source_name` (order matters)
  const trackName = data.raceInfo.track;
  const trackSource = "fanodds";

  // optional: set a better TZ if you know it per track
  const timezoneGuess = "UTC";

  const track = await prisma.track.upsert({
    where: {
      source_name: { source: trackSource, name: trackName },
    },
    update: {},
    create: { source: trackSource, name: trackName, timezone: timezoneGuess },
  });

  // 2) Build unique sets of people/horses
  const allResults = data.raceResults.flatMap(r => r.results);

  const jockeyNames = Array.from(new Set(allResults.map(r => r.jockey).filter(Boolean)));
  const trainerNames = Array.from(new Set(allResults.map(r => r.trainer).filter(Boolean)));
  const horseNames   = Array.from(new Set(allResults.map(r => r.horse).filter(Boolean)));

  // 3) Ensure Jockey records exist
  const existingJockeys = await prisma.jockey.findMany({
    where: { name: { in: jockeyNames } },
    select: { id: true, name: true },
  });
  const existingJockeyNames = new Set(existingJockeys.map(j => j.name));
  for (const name of jockeyNames) {
    if (!existingJockeyNames.has(name)) {
      await prisma.jockey.create({ data: { name, age: 0 } }); // your schema has age required
    }
  }
  const jockeyRows = await prisma.jockey.findMany({
    where: { name: { in: jockeyNames } },
    select: { id: true, name: true },
  });
  const jockeyIdByName = new Map(jockeyRows.map(j => [j.name, j.id]));

  // 4) Ensure Trainer records exist
  const existingTrainers = await prisma.trainer.findMany({
    where: { name: { in: trainerNames } },
    select: { id: true, name: true },
  });
  const existingTrainerNames = new Set(existingTrainers.map(t => t.name));
  for (const name of trainerNames) {
    if (!existingTrainerNames.has(name)) {
      await prisma.trainer.create({ data: { name, age: 0, wins: 0 } }); // age & wins required in your schema
    }
  }
  const trainerRows = await prisma.trainer.findMany({
    where: { name: { in: trainerNames } },
    select: { id: true, name: true },
  });
  const trainerIdByName = new Map(trainerRows.map(t => [t.name, t.id]));

  // 5) (Optional) Ensure Horse records exist — your Result stores `horse` as string,
  //    but you also have a Horse model used elsewhere. Keep these in sync.
  const existingHorses = await prisma.horse.findMany({
    where: { name: { in: horseNames } },
    select: { id: true, name: true },
  });
  const existingHorseNames = new Set(existingHorses.map(h => h.name));
  for (const name of horseNames) {
    if (!existingHorseNames.has(name)) {
      await prisma.horse.create({ data: { name, age: 0 } });
    }
  }

  // 6) TrackDay: store the **track-local calendar date** in `date @db.Date`
  //    and upsert by (trackId, date) -> input `trackId_date`
  const tzid = track.timezone ?? "UTC";
  const dateOnlyStr = dayjs.tz(data.raceInfo.date, tzid).format("YYYY-MM-DD");
  const dateOnly = new Date(dateOnlyStr); // Prisma accepts Date for @db.Date

  const trackDay = await prisma.trackDay.upsert({
    where: { trackId_date: { trackId: track.id, date: dateOnly } },
    update: {},
    create: { trackId: track.id, date: dateOnly, status: "official" },
  });

  // 7) Upsert races + results in a transaction
  await prisma.$transaction(async (tx) => {
    for (const race of data.raceResults) {
      // Race upsert by (trackDayId, number) -> input `trackDayId_number`
      const savedRace = await tx.race.upsert({
        where: { trackDayId_number: { trackDayId: trackDay.id, number: race.raceNumber } },
        update: {
          surface: race.raceConditions.surface,
          distanceM: race.raceConditions.distanceM,
          status: "official",
        },
        create: {
          trackDayId: trackDay.id,
          number: race.raceNumber,
          surface: race.raceConditions.surface,
          distanceM: race.raceConditions.distanceM,
          status: "official",
        },
      });

      // Rebuild results deterministically: delete then createMany
      await tx.result.deleteMany({ where: { raceId: savedRace.id } });

      const rows = race.results.map((r) => ({
        raceId: savedRace.id,
        position: r.position,
        horse: r.horse, // your Result model stores horse as string
        jockeyId: jockeyIdByName.get(r.jockey)!,   // non-null if created/found above
        trainerId: trainerIdByName.get(r.trainer)!,// non-null if created/found above
        scratch: false,
        raceTime: r.raceTime
          ? (r.raceTime.minutes * 60 * 1000) +
            (r.raceTime.seconds * 1000) +
            r.raceTime.milliseconds
          : null,
        money: r.money,
      }));

      // If any name didn't resolve (shouldn't happen), filter defensively
      const safeRows = rows.filter(row => row.jockeyId && row.trainerId);

      if (safeRows.length) {
        await tx.result.createMany({ data: safeRows });
      }
    }
  });
  return data;
}