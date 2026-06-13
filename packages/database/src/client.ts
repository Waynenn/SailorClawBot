export interface PrismaClientLike {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

type PrismaClientConstructor = new () => PrismaClientLike;

interface PrismaClientModule {
  PrismaClient: PrismaClientConstructor;
}

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<PrismaClientModule>;

export async function createPrismaClient(): Promise<PrismaClientLike> {
  const { PrismaClient } = await dynamicImport('@prisma/client');
  return new PrismaClient();
}
