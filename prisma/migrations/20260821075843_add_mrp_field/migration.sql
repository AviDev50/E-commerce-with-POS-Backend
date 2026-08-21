-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `mrp` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `mrp` DECIMAL(10, 2) NULL;
