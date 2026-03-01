-- CreateTable
CREATE TABLE "dismissed_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dismissed_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dismissed_recommendations_user_id_idx" ON "dismissed_recommendations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dismissed_recommendations_user_id_game_id_key" ON "dismissed_recommendations"("user_id", "game_id");

-- AddForeignKey
ALTER TABLE "dismissed_recommendations" ADD CONSTRAINT "dismissed_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dismissed_recommendations" ADD CONSTRAINT "dismissed_recommendations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
