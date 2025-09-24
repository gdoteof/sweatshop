import * as restate from "@restatedev/restate-sdk";
import type { ScrapeRequest, ScrapeResult } from "./types";
import { PrismaClient } from "../../generated/prisma";
import prisma from "../db";

// Restate helps you implement resilient applications:
//  - Automatic retries
//  - Tracking progress of execution and preventing re-execution of completed work on retries
//  - Providing durable building blocks like timers, promises, and messaging: recoverable and revivable anywhere
//
// Applications consist of services with handlers that can be called over HTTP or Kafka.
// Handlers can be called at http://restate:8080/ServiceName/handlerName
//
// Restate persists and proxies HTTP requests to handlers and manages their execution:
//
// ┌────────┐   ┌─────────┐   ┌────────────────────────────┐
// │ HTTP   │ → │ Restate │ → │ Restate Service (with SDK) │
// │ Client │ ← │         │ ← │   handler1(), handler2()   │
// └────────┘   └─────────┘   └────────────────────────────┘
//
// The SDK lets you implement handlers with regular code and control flow.
// Handlers have access to a Context that provides durable building blocks that get persisted in Restate.
// Whenever a handler uses the Restate Context, an event gets persisted in Restate's log.
// After a failure, a retry is triggered and this log gets replayed to recover the state of the handler.



const scrape = (url: string): Promise<ScrapeResult> => {
  // Simulate scraping the race information from the URL
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        raceInfo: {
          track: "Track Name",
          date: "2023-10-01",
        },
        raceResults: [
          {
            results: [
              {
                position: 1,
                horse: "Horse 1",
                jockey: "Jockey 1",
                trainer: "Trainer 1",
                raceTime: {
                  minutes: 1,
                  seconds: 30,
                  milliseconds: 500,
                },
                money: 1000,
              },
            ],
            raceNumber: 1,
            raceConditions: {
              time: 120,
              temperature: 25,
              humidity: 60,
              windSpeed: 10,
              surface: "turf",
              speed: "fast",
            },
          },
        ],
      });
    }, 1000);
  });
};

const storeSilver = (data: ScrapeResult): Promise<boolean> => {
  // Simulate storing the scraped data
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 1000);
  });
};

const ScrapeService = restate.service({
  name: "ScrapeService",
  handlers: {
    add: async (ctx: restate.Context, req: ScrapeRequest) => {
      // Restate persists the result of all `ctx` actions and recovers them after failures
      // For example, generate a stable idempotency key:
      const requestId = ctx.rand.uuidv4();

      // ctx.run persists results of successful actions and skips execution on retries
      // Failed actions (timeouts, API downtime, etc.) get retried
      const scrapeResult = await ctx.run(() => 
      {

        const raceData = scrape(req.url);
        return raceData;

      } );
        await ctx.run(() => storeSilver(scrapeResult));
    },
  },
});


const ScrapeDispatcher = restate.service({
  name: "ScrapeDispatcher",
  handlers: {
  },
});

// Create an HTTP endpoint to serve your services on port 9080
// or use createEndpointHandler() to run on Lambda, Deno, Bun, Cloudflare Workers, ...
restate.serve({
  services: [ScrapeService],
  port: 9080,
});

/*
Check the README to learn how to run Restate.
Then invoke this function and see in the log how it recovers.
Each action (e.g. "created recurring payment") is only logged once across all retries.
Retries did not re-execute the successful operations.

curl localhost:8080/SubscriptionService/add -H 'content-type: application/json' -d \
'{
    "userId": "Sam Beckett",
    "creditCard": "1234-5678-9012-3456",
    "subscriptions" : ["Netflix", "Disney+", "HBO Max"]
}'
*/