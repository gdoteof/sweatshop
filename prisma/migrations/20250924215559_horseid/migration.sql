/*
  Warnings:

  - You are about to drop the column `horse` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the `_HorseToResult` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `horseId` to the `Result` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."_HorseToResult" DROP CONSTRAINT "_HorseToResult_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_HorseToResult" DROP CONSTRAINT "_HorseToResult_B_fkey";

-- AlterTable
ALTER TABLE "public"."Result" DROP COLUMN "horse",
ADD COLUMN     "horseId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."TrackDay" ALTER COLUMN "date" SET DATA TYPE DATE;

-- DropTable
DROP TABLE "public"."_HorseToResult";

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "public"."Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
