/*
  Warnings:

  - Added the required column `dob` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `customers` ADD COLUMN `dob` DATE NOT NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL;
