-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isLegal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "author" TEXT,
    "tags" TEXT[],
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_listings" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "groupName" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "lastChapterNumber" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "number" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER,
    "title" TEXT,
    "groupName" TEXT,
    "groupId" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageCache" JSONB,
    "pageCacheExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_slug_key" ON "sources"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE INDEX "series_title_idx" ON "series"("title");

-- CreateIndex
CREATE INDEX "series_listings_seriesId_idx" ON "series_listings"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "series_listings_sourceId_externalId_key" ON "series_listings"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "chapters_seriesId_number_idx" ON "chapters"("seriesId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_listingId_externalId_key" ON "chapters"("listingId", "externalId");

-- AddForeignKey
ALTER TABLE "series_listings" ADD CONSTRAINT "series_listings_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_listings" ADD CONSTRAINT "series_listings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "series_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

