-- AlterTable
ALTER TABLE "library_items" ADD COLUMN     "platforms_played" TEXT[] DEFAULT ARRAY[]::TEXT[];
