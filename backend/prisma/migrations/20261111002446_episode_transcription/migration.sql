-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "showNotes" TEXT,
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "transcriptStatus" TEXT NOT NULL DEFAULT 'none';
