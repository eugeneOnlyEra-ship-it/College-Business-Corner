/*
  Warnings:

  - You are about to drop the column `captureStatus` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `netCents` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `paypalCaptureId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `paypalFeeCents` on the `OrderItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "OrderPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paypalMerchantId" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "paypalFeeCents" INTEGER,
    "netCents" INTEGER,
    "paypalCaptureId" TEXT,
    "captureStatus" TEXT,
    CONSTRAINT "OrderPayout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderPayout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("businessId", "id", "listingId", "orderId", "platformFeeCents", "quantity", "unitPriceCents") SELECT "businessId", "id", "listingId", "orderId", "platformFeeCents", "quantity", "unitPriceCents" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_businessId_idx" ON "OrderItem"("businessId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OrderPayout_businessId_idx" ON "OrderPayout"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayout_orderId_businessId_key" ON "OrderPayout"("orderId", "businessId");
