import type { Container } from "../container.js";
import { COLORS } from "../lib/colors.js";
import { removeGuildBan, sendModLog } from "../lib/discord.js";

/**
 * Lift temp-bans whose expiry has passed. Discord has NO native auto-unban for
 * timed bans, so this job is the only thing that ends them — the truly critical
 * durable action. Idempotent: a manual unban (404) still flips isActive.
 */
export async function processBanExpiry(c: Container): Promise<void> {
	const expired = await c.banRepo.findExpired();
	if (expired.length === 0) return;

	c.logger.info("Processing expired bans", { count: expired.length });

	for (const ban of expired) {
		try {
			const result = await removeGuildBan(c.rest, ban.guildId, ban.userId);
			await c.banRepo.deactivate(ban.id);

			await sendModLog(c.rest, c.guildSettingsRepo, ban.guildId, {
				title: "⏲️ Ban Expired",
				color: COLORS.restorative,
				description:
					result === "absent"
						? `<@${ban.userId}> was already unbanned manually. Case #${ban.caseNumber} closed.`
						: `<@${ban.userId}> has been unbanned automatically. Case #${ban.caseNumber}.`,
				fields: [{ name: "User", value: `${ban.userId}`, inline: true }],
				timestamp: new Date().toISOString(),
			}).catch((err) =>
				c.logger.warn("Mod-log failed for ban expiry", {
					id: ban.id,
					err: String(err),
				}),
			);
		} catch (error) {
			c.logger.error("Failed to process ban expiry", {
				id: ban.id,
				guildId: ban.guildId,
				error: String(error),
			});
		}
	}
}
