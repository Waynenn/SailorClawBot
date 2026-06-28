import type { BlackjackSessionDto } from "../types/index.js";

export interface BlackjackSessionRepository {
	findById(id: string): Promise<BlackjackSessionDto | null>;
	create(
		input: Omit<BlackjackSessionDto, "createdAt">,
	): Promise<BlackjackSessionDto>;
	update(
		id: string,
		data: Partial<
			Pick<BlackjackSessionDto, "playerCards" | "dealerCards" | "deck" | "bet">
		>,
	): Promise<BlackjackSessionDto>;
	/**
	 * Atomically delete and return the session, or null if it was already gone.
	 * This is the capture gate: only the caller that actually removed the row
	 * proceeds with the payout/refund, so a concurrent resolve, TTL cleaner and
	 * startup recovery can never double-credit the same bet.
	 */
	deleteCapture(id: string): Promise<BlackjackSessionDto | null>;
	findAll(): Promise<BlackjackSessionDto[]>;
	findStale(cutoff: Date): Promise<BlackjackSessionDto[]>;
}
