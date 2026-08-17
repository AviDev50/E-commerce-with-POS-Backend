-- CreateTable
CREATE TABLE `held_orders` (
    `id` VARCHAR(191) NOT NULL,
    `cashierId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `items` JSON NOT NULL,
    `note` VARCHAR(191) NULL,
    `status` ENUM('HELD', 'RESUMED', 'CANCELLED') NOT NULL DEFAULT 'HELD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resumedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `held_orders` ADD CONSTRAINT `held_orders_cashierId_fkey` FOREIGN KEY (`cashierId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `held_orders` ADD CONSTRAINT `held_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
