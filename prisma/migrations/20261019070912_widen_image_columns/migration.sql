-- AlterTable
ALTER TABLE `product_variants` MODIFY `images` TEXT NULL;

-- AlterTable
ALTER TABLE `products` MODIFY `description` TEXT NULL,
    MODIFY `images` TEXT NULL;
