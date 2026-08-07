/*
  Warnings:

  - A unique constraint covering the columns `[returnRequestId]` on the table `refunds` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `returnedQty` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `deliveredAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `refunds` ADD COLUMN `returnRequestId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `return_requests` (
    `id` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `type` ENUM('RETURN', 'EXCHANGE') NOT NULL DEFAULT 'RETURN',
    `reason` VARCHAR(191) NOT NULL,
    `reasonNote` VARCHAR(191) NULL,
    `images` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'RECEIVED', 'REFUNDED', 'EXCHANGED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `exchangeVariantId` VARCHAR(191) NULL,
    `exchangeOrderId` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `refunds_returnRequestId_key` ON `refunds`(`returnRequestId`);

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_exchangeVariantId_fkey` FOREIGN KEY (`exchangeVariantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_exchangeOrderId_fkey` FOREIGN KEY (`exchangeOrderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
