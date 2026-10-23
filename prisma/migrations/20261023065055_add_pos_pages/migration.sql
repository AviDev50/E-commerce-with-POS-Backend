-- CreateTable
CREATE TABLE `pos_pages` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('PRIVACY_POLICY', 'TERMS_AND_CONDITIONS', 'ABOUT_US') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_pages_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
