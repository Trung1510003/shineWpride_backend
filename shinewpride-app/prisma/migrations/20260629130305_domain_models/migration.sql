-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "ScheduleSlot" AS ENUM ('SIX_PM', 'EIGHT_PM');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WatermarkStatus" AS ENUM ('DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'ACTIVE',
    "shopifyCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlTemplate" TEXT NOT NULL,
    "scheduleSlot" "ScheduleSlot" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberEmail" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatermarkLog" (
    "id" TEXT NOT NULL,
    "shopifyMediaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "WatermarkStatus" NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "watermarkedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatermarkLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscriber_shopDomain_idx" ON "Subscriber"("shopDomain");

-- CreateIndex
CREATE INDEX "Subscriber_status_idx" ON "Subscriber"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_shopDomain_email_key" ON "Subscriber"("shopDomain", "email");

-- CreateIndex
CREATE INDEX "EmailSendLog_campaignId_idx" ON "EmailSendLog"("campaignId");

-- CreateIndex
CREATE INDEX "EmailSendLog_subscriberEmail_idx" ON "EmailSendLog"("subscriberEmail");

-- CreateIndex
CREATE INDEX "EmailSendLog_sentAt_idx" ON "EmailSendLog"("sentAt");

-- CreateIndex
CREATE INDEX "WatermarkLog_shopifyMediaId_idx" ON "WatermarkLog"("shopifyMediaId");

-- CreateIndex
CREATE INDEX "WatermarkLog_productId_idx" ON "WatermarkLog"("productId");

-- CreateIndex
CREATE INDEX "WatermarkLog_createdAt_idx" ON "WatermarkLog"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailSendLog" ADD CONSTRAINT "EmailSendLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
