-- AlterTable
ALTER TABLE `refunds` ADD COLUMN `method` ENUM('CASH', 'CARD', 'UPI', 'WALLET', 'COD', 'NETBANKING') NULL;
