-- CreateEnum
CREATE TYPE "GstType" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "cgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "igstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "gstType" "GstType";

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "state" TEXT;
