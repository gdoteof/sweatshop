/*
  Warnings:

  - You are about to drop the column `content` on the `RawIngest` table. All the data in the column will be lost.
  - You are about to drop the column `contentType` on the `RawIngest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."RawIngest" DROP COLUMN "content",
DROP COLUMN "contentType";

-- CreateTable
CREATE TABLE "public"."RawIngestBlob" (
    "id" BIGSERIAL NOT NULL,
    "rawIngestId" BIGINT NOT NULL,
    "content" BYTEA NOT NULL,

    CONSTRAINT "RawIngestBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RawIngestBlob_rawIngestId_key" ON "public"."RawIngestBlob"("rawIngestId");

-- AddForeignKey
ALTER TABLE "public"."RawIngestBlob" ADD CONSTRAINT "RawIngestBlob_rawIngestId_fkey" FOREIGN KEY ("rawIngestId") REFERENCES "public"."RawIngest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
