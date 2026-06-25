-- AlterTable
ALTER TABLE `endpoints` ADD COLUMN `maxRetries` INTEGER NOT NULL DEFAULT 8,
    ADD COLUMN `retryBackoffMs` INTEGER NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;
