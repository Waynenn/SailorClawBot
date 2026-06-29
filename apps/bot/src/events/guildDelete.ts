import type { Logger } from "@sailorclawbot/core";
import type { Guild } from "discord.js";

export function registerGuildDeleteHandler(
	client: import("discord.js").Client,
	logger: Logger,
): void {
	client.on("guildDelete", (guild: Guild) => {
		logger.info("Bot removed from guild", {
			guildId: guild.id,
			name: guild.name,
		});
	});
}
