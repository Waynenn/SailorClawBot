import { DomainError } from './DomainError.js';

export class CooldownError extends DomainError {
  public readonly remainingMs: number;

  public constructor(remainingMs: number) {
    super('COOLDOWN', `On cooldown. Try again in ${Math.ceil(remainingMs / 1000)}s.`);
    this.remainingMs = remainingMs;
    this.name = 'CooldownError';
  }
}
