-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "taxRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "taxRate" DECIMAL(5,2);
