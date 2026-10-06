import { PrismaClient } from '@prisma/client';

const prismaGlobal = globalThis as unknown as {
  estuaryPrisma?: PrismaClient;
};

export const prisma =
  prismaGlobal.estuaryPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.estuaryPrisma = prisma;
}