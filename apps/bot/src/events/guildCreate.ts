import type { GuildService, Logger } from "@sailorclawbot/core";
import type { Guild } from "discord.js";

export function registerGuildCreateHandler(
	client: import("discord.js").Client,
	guildService: GuildService,
	logger: Logger,
): void {
	client.on("guildCreate", async (guild: Guild) => {
		try {
			await guildService.registerGuild(guild.id, guild.name);
			logger.info("Guild registered", { guildId: guild.id, name: guild.name });
		} catch (error) {
			logger.error("Failed to register guild", {
				guildId: guild.id,
				error: String(error),
			});
		}
	});
}
