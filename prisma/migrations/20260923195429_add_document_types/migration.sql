-- AlterTable
ALTER TABLE "UploadedDocument" ADD COLUMN     "documentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
