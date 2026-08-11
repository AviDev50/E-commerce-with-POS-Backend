-- AlterTable
ALTER TABLE `customers` MODIFY `dob` DATE NULL,
    MODIFY `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL;
