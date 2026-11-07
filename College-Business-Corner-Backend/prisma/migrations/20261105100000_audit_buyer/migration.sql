-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "buyerEmail" TEXT;

-- Attribute existing decisions that already belong to an order to that order's buyer (the rest stay private to nobody).
UPDATE "AuditLog"
SET "buyerEmail" = (
  SELECT u."email" FROM "Order" o JOIN "User" u ON u."id" = o."buyerId" WHERE o."id" = "AuditLog"."orderId"
)
WHERE "orderId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "AuditLog_buyerEmail_idx" ON "AuditLog"("buyerEmail");
