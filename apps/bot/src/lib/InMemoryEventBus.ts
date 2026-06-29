import type { DomainEvent, EventBus, Logger } from "@sailorclawbot/core";

export class InMemoryEventBus implements EventBus {
	public constructor(private readonly logger: Logger) {}

	public async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
		this.logger.info("Event published", {
			name: event.name,
			occurredAt: event.occurredAt.toISOString(),
		});
	}
}
