CREATE TABLE "beta_programmes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manager_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_programmes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_programmes_code_key" ON "beta_programmes"("code");
