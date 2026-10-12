-- AlterTable
ALTER TABLE `refunds` ADD COLUMN `failureReason` VARCHAR(191) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `payoutMethodId` VARCHAR(191) NULL,
    ADD COLUMN `transactionRef` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `return_requests` ADD COLUMN `payoutMethodId` VARCHAR(191) NULL,
    ADD COLUMN `refundTo` ENUM('WALLET', 'UPI') NULL,
    MODIFY `settlement` ENUM('NONE', 'COLLECT_AT_COUNTER', 'COLLECT_ON_DELIVERY', 'REFUND_AT_COUNTER', 'WALLET_CREDIT', 'UPI_TRANSFER') NULL;

-- CreateTable
CREATE TABLE `payout_methods` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `type` ENUM('UPI') NOT NULL DEFAULT 'UPI',
    `upiId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payout_methods_customerId_upiId_key`(`customerId`, `upiId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payoutMethodId_fkey` FOREIGN KEY (`payoutMethodId`) REFERENCES `payout_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payout_methods` ADD CONSTRAINT `payout_methods_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_payoutMethodId_fkey` FOREIGN KEY (`payoutMethodId`) REFERENCES `payout_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
