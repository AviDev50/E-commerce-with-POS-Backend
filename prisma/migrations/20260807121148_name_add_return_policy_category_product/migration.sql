-- AlterTable
ALTER TABLE `categories` ADD COLUMN `isReturnable` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `isReturnable` BOOLEAN NULL;
