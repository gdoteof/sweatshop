/*
  Warnings:

  - Added the required column `contentType` to the `RawIngest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."RawIngest" ADD COLUMN     "contentType" TEXT NOT NULL;
