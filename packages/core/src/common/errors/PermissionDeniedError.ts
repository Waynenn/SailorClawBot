import { DomainError } from './DomainError.js';

/**
 * Thrown when an actor lacks permission to perform an action.
 */
export class PermissionDeniedError extends DomainError {
  public constructor(message: string) {
    super('PERMISSION_DENIED', message);
    this.name = 'PermissionDeniedError';
  }
}
