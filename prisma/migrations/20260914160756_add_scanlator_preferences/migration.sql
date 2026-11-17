-- CreateTable
CREATE TABLE "series_scanlator_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_scanlator_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "series_scanlator_preferences_userId_idx" ON "series_scanlator_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "series_scanlator_preferences_userId_seriesId_key" ON "series_scanlator_preferences"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "series_scanlator_preferences" ADD CONSTRAINT "series_scanlator_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_scanlator_preferences" ADD CONSTRAINT "series_scanlator_preferences_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
