-- CreateTable
CREATE TABLE "public"."Horse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_HorseToRace" (
    "A" TEXT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_HorseToRace_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_HorseToResult" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_HorseToResult_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_HorseToRace_B_index" ON "public"."_HorseToRace"("B");

-- CreateIndex
CREATE INDEX "_HorseToResult_B_index" ON "public"."_HorseToResult"("B");

-- AddForeignKey
ALTER TABLE "public"."_HorseToRace" ADD CONSTRAINT "_HorseToRace_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HorseToRace" ADD CONSTRAINT "_HorseToRace_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HorseToResult" ADD CONSTRAINT "_HorseToResult_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HorseToResult" ADD CONSTRAINT "_HorseToResult_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
