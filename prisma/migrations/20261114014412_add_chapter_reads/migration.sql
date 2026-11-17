-- CreateTable
CREATE TABLE "chapter_reads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "number" DOUBLE PRECISION NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_reads_userId_idx" ON "chapter_reads"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_reads_userId_seriesId_number_key" ON "chapter_reads"("userId", "seriesId", "number");

-- AddForeignKey
ALTER TABLE "chapter_reads" ADD CONSTRAINT "chapter_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_reads" ADD CONSTRAINT "chapter_reads_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
