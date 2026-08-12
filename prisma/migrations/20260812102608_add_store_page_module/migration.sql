-- CreateTable
CREATE TABLE `store_pages` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('ABOUT_US', 'TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'RETURN_AND_REFUND_POLICY') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_pages_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
