-- CreateTable
CREATE TABLE "RunLock" (
    "id" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "RunLock_pkey" PRIMARY KEY ("id")
);
