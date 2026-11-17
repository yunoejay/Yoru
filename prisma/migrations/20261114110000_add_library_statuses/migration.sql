-- AlterTable
-- The personal library reuses the existing bookmark relation. Existing rows
-- become "plan to read"; `updatedAt` starts at the migration time so
-- /my-library has a sensible initial ordering.
ALTER TABLE "bookmarks" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'plan_to_read',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
