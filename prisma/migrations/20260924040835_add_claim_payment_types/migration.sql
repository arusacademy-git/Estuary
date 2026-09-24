-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentType" ADD VALUE 'INTERNET_COMMUTE_CLAIM';
ALTER TYPE "PaymentType" ADD VALUE 'MEDICAL_CLAIM';
ALTER TYPE "PaymentType" ADD VALUE 'MILEAGE_CLAIM';
ALTER TYPE "PaymentType" ADD VALUE 'PD_CLAIM';
ALTER TYPE "PaymentType" ADD VALUE 'TECH_CLAIM';
