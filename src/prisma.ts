import { PrismaClient } from "@prisma/client";

// ให้ BigInt ส่ง JSON ได้
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"] // เติม "query" ถ้าต้องการ debug
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
