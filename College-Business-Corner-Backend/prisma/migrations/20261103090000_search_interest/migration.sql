-- CreateTable
CREATE TABLE "SearchInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1
);

-- CreateIndex
CREATE INDEX "SearchInterest_term_idx" ON "SearchInterest"("term");

-- CreateIndex
CREATE UNIQUE INDEX "SearchInterest_day_term_key" ON "SearchInterest"("day", "term");
