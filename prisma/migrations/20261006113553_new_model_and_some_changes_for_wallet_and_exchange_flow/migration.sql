-- AlterTable
ALTER TABLE `orders` ADD COLUMN `isExchange` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `refunds` ADD COLUMN `shiftId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `return_requests` ADD COLUMN `exchangeProductId` VARCHAR(191) NULL,
    ADD COLUMN `newValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `originalValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `priceDiff` DECIMAL(10, 2) NULL,
    ADD COLUMN `settlement` ENUM('NONE', 'COLLECT_AT_COUNTER', 'COLLECT_ON_DELIVERY', 'REFUND_AT_COUNTER', 'WALLET_CREDIT') NULL;

-- AlterTable
ALTER TABLE `store_settings` ADD COLUMN `returnWindowDays` INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE `wallets` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallets_customerId_key`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `type` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balanceAfter` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallet_transactions_returnRequestId_key`(`returnRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_exchangeProductId_fkey` FOREIGN KEY (`exchangeProductId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
