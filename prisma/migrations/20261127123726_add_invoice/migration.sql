-- AlterTable
ALTER TABLE `products` ADD COLUMN `hsnCode` VARCHAR(8) NULL;

-- AlterTable
ALTER TABLE `store_settings` ADD COLUMN `gstin` VARCHAR(15) NULL,
    ADD COLUMN `invoicePrefix` VARCHAR(3) NOT NULL DEFAULT 'INV',
    ADD COLUMN `legalName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(16) NOT NULL,
    `financialYear` VARCHAR(7) NOT NULL,
    `snapshot` JSON NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoices_orderId_key`(`orderId`),
    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_counters` (
    `financialYear` VARCHAR(7) NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`financialYear`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
