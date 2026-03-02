-- AlterTable
ALTER TABLE "users" ADD COLUMN "steam_id" TEXT,
ADD COLUMN "steam_player_name" TEXT,
ADD COLUMN "steam_avatar_url" TEXT;

-- AlterTable
ALTER TABLE "library_items" ADD COLUMN "steam_import" BOOLEAN NOT NULL DEFAULT false;
