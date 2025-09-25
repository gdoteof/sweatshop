-- CreateTable
CREATE TABLE "public"."Track" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "timezone" TEXT,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrackDay" (
    "id" BIGSERIAL NOT NULL,
    "trackId" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Race" (
    "id" BIGSERIAL NOT NULL,
    "trackDayId" BIGINT NOT NULL,
    "number" INTEGER NOT NULL,
    "surface" TEXT,
    "distanceM" INTEGER,
    "classCode" TEXT,
    "status" TEXT NOT NULL,
    "offTimeUtc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CrawlTarget" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "parentId" BIGINT,
    "dedupeKey" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RawIngest" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "contentSha" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "meta" JSONB,
    "uniq" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawIngest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VendorKey" (
    "id" BIGSERIAL NOT NULL,
    "vendor" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "ourType" TEXT NOT NULL,
    "ourId" BIGINT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Result" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "horse" TEXT NOT NULL,
    "jockeyId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "raceTime" INTEGER,
    "money" INTEGER NOT NULL,
    "raceId" BIGINT NOT NULL,
    "scratch" BOOLEAN NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Jockey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,

    CONSTRAINT "Jockey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trainer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "Trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_RaceToTrainer" (
    "A" BIGINT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RaceToTrainer_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_JockeyToRace" (
    "A" TEXT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_JockeyToRace_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_vendorId_key" ON "public"."Track"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_source_name_key" ON "public"."Track"("source", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TrackDay_trackId_date_key" ON "public"."TrackDay"("trackId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Race_trackDayId_number_key" ON "public"."Race"("trackDayId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlTarget_dedupeKey_key" ON "public"."CrawlTarget"("dedupeKey");

-- CreateIndex
CREATE INDEX "CrawlTarget_source_kind_idx" ON "public"."CrawlTarget"("source", "kind");

-- CreateIndex
CREATE INDEX "CrawlTarget_status_idx" ON "public"."CrawlTarget"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RawIngest_uniq_key" ON "public"."RawIngest"("uniq");

-- CreateIndex
CREATE INDEX "RawIngest_source_url_idx" ON "public"."RawIngest"("source", "url");

-- CreateIndex
CREATE UNIQUE INDEX "VendorKey_vendor_type_vendorId_key" ON "public"."VendorKey"("vendor", "type", "vendorId");

-- CreateIndex
CREATE INDEX "_RaceToTrainer_B_index" ON "public"."_RaceToTrainer"("B");

-- CreateIndex
CREATE INDEX "_JockeyToRace_B_index" ON "public"."_JockeyToRace"("B");

-- AddForeignKey
ALTER TABLE "public"."TrackDay" ADD CONSTRAINT "TrackDay_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "public"."Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Race" ADD CONSTRAINT "Race_trackDayId_fkey" FOREIGN KEY ("trackDayId") REFERENCES "public"."TrackDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrawlTarget" ADD CONSTRAINT "CrawlTarget_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."CrawlTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_jockeyId_fkey" FOREIGN KEY ("jockeyId") REFERENCES "public"."Jockey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."Trainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RaceToTrainer" ADD CONSTRAINT "_RaceToTrainer_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RaceToTrainer" ADD CONSTRAINT "_RaceToTrainer_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_JockeyToRace" ADD CONSTRAINT "_JockeyToRace_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Jockey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_JockeyToRace" ADD CONSTRAINT "_JockeyToRace_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
