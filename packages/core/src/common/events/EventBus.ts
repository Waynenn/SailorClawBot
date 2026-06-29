import type { EventName } from "@sailorclawbot/contracts";

export interface DomainEvent<TPayload = unknown> {
	name: EventName;
	payload: TPayload;
	occurredAt: Date;
}

export interface EventBus {
	publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}
