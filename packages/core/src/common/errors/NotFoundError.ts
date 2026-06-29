import { DomainError } from "./DomainError.js";

/**
 * Thrown when a requested entity does not exist.
 * `resource` optionally names the entity type (e.g. "Warning", "Guild").
 */
export class NotFoundError extends DomainError {
	public readonly resource?: string;

	public constructor(message: string, resource?: string) {
		super("NOT_FOUND", message);
		this.name = "NotFoundError";
		this.resource = resource;
	}
}
