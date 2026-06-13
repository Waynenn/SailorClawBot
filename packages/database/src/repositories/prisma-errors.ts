import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@sailorclawbot/core';

/**
 * Translates Prisma's low-level errors into domain errors so callers
 * depend on `@sailorclawbot/core` errors, never on Prisma internals.
 *
 * Always throws — return type is `never` so it terminates a catch block.
 */
export function translatePrismaError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // unique constraint
        throw new ConflictError(`${context}: unique constraint violated`);
      case 'P2003': // foreign key constraint
        throw new ValidationError(
          `${context}: referenced record does not exist (create the guild first)`
        );
      case 'P2025': // record not found
        throw new NotFoundError(`${context}: record not found`);
      default:
        throw new ValidationError(`${context}: ${error.message}`);
    }
  }
  throw error;
}
