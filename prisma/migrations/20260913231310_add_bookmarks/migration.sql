-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_seriesId_key" ON "bookmarks"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
