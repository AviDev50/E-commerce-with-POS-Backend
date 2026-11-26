-- CreateTable
CREATE TABLE `pending_checkouts` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `addressId` VARCHAR(191) NOT NULL,
    `couponCode` VARCHAR(191) NULL,
    `items` JSON NOT NULL,
    `cartItemIds` JSON NULL,
    `expectedTotal` DECIMAL(10, 2) NOT NULL,
    `gatewayOrderId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `orderId` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `refundId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pending_checkouts_gatewayOrderId_key`(`gatewayOrderId`),
    INDEX `pending_checkouts_customerId_idx`(`customerId`),
    INDEX `pending_checkouts_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
