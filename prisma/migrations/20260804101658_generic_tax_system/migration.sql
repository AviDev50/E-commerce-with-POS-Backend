/*
  Warnings:

  - You are about to drop the column `taxRate` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `cgstAmount` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `igstAmount` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `sgstAmount` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `gstType` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `categories` DROP COLUMN `taxRate`,
    ADD COLUMN `taxClassId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order_items` DROP COLUMN `cgstAmount`,
    DROP COLUMN `igstAmount`,
    DROP COLUMN `sgstAmount`,
    DROP COLUMN `taxRate`,
    ADD COLUMN `taxBreakdown` JSON NULL;

-- AlterTable
ALTER TABLE `orders` DROP COLUMN `gstType`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `taxRate`,
    ADD COLUMN `taxClassId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `store_settings` ADD COLUMN `country` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `tax_classes` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tax_classes_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_rates` (
    `id` VARCHAR(191) NOT NULL,
    `taxClassId` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `appliesWhen` ENUM('DESTINATION', 'ORIGIN_MATCH', 'ORIGIN_MISMATCH') NOT NULL DEFAULT 'DESTINATION',
    `isCompound` BOOLEAN NOT NULL DEFAULT false,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_taxClassId_fkey` FOREIGN KEY (`taxClassId`) REFERENCES `tax_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_taxClassId_fkey` FOREIGN KEY (`taxClassId`) REFERENCES `tax_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_rates` ADD CONSTRAINT `tax_rates_taxClassId_fkey` FOREIGN KEY (`taxClassId`) REFERENCES `tax_classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
