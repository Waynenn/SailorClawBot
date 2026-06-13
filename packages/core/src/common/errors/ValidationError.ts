import { DomainError } from './DomainError.js';

/**
 * Thrown when input fails validation (empty required field, out-of-range value, etc.).
 * `field` optionally identifies which input was invalid.
 */
export class ValidationError extends DomainError {
  public readonly field?: string;

  public constructor(message: string, field?: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
