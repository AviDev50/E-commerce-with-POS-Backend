/*
  Warnings:

  - A unique constraint covering the columns `[gatewayOrderId]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `gatewayOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payments` MODIFY `method` ENUM('CASH', 'CARD', 'UPI', 'WALLET', 'COD', 'ONLINE') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `orders_gatewayOrderId_key` ON `orders`(`gatewayOrderId`);
