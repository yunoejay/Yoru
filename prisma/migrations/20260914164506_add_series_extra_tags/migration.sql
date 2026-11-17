-- AlterTable
ALTER TABLE "series" ADD COLUMN     "extraTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
