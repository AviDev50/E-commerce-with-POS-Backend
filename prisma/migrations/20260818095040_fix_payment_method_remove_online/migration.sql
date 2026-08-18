/*
  Warnings:

  - The values [ONLINE] on the enum `payments_method` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `payments` MODIFY `method` ENUM('CASH', 'CARD', 'UPI', 'WALLET', 'COD', 'NETBANKING') NOT NULL;
