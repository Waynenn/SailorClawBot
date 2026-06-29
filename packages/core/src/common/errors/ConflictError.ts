import { DomainError } from "./DomainError.js";

/**
 * Thrown when an action conflicts with current state
 * (e.g. user already muted, duplicate unique key).
 * `code` can be specialised (e.g. "USER_ALREADY_MUTED") while keeping the type.
 */
export class ConflictError extends DomainError {
	public constructor(message: string, code = "CONFLICT") {
		super(code, message);
		this.name = "ConflictError";
	}
}
