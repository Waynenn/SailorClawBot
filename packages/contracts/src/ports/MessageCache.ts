/**
 * Port: own message cache (Redis-backed in production).
 *
 * Discord does NOT deliver the content of deleted/old messages that are not in
 * its gateway cache. To match Carl-bot-grade logging (show deleted/edited
 * content + diff), the bot caches every message it sees and reads the "before"
 * version from here on delete/update.
 */
export interface CachedMessage {
	id: string;
	guildId: string;
	channelId: string;
	authorId: string;
	authorTag: string;
	content: string;
	attachments: string[]; // attachment URLs
	createdAt: string; // ISO-8601
}

export interface MessageCache {
	/** Store a message. ttlSeconds defaults to the implementation's retention window. */
	set(message: CachedMessage, ttlSeconds?: number): Promise<void>;
	get(messageId: string): Promise<CachedMessage | null>;
	delete(messageId: string): Promise<void>;
}
