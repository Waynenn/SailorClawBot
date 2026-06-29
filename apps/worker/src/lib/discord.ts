import type { GuildSettingsRepository } from "@sailorclawbot/contracts";
import { type REST, Routes } from "discord.js";

export interface DiscordEmbed {
	title?: string;
	description?: string;
	color?: number;
	fields?: { name: string; value: string; inline?: boolean }[];
	timestamp?: string;
}

/** Discord HTTP error shape (discord.js DiscordAPIError exposes a numeric status). */
function statusOf(error: unknown): number | undefined {
	if (typeof error === "object" && error !== null && "status" in error) {
		const s = (error as { status: unknown }).status;
		return typeof s === "number" ? s : undefined;
	}
	return undefined;
}

/** Remove a guild ban. Returns 'removed', or 'absent' if it was already gone (404). */
export async function removeGuildBan(
	rest: REST,
	guildId: string,
	userId: string,
): Promise<"removed" | "absent"> {
	try {
		await rest.delete(Routes.guildBan(guildId, userId), {
			reason: "Temp-ban expired",
		});
		return "removed";
	} catch (error) {
		if (statusOf(error) === 404) return "absent";
		throw error;
	}
}

/** Remove a role from a member. Swallows 404 (member left / role gone). */
export async function removeMemberRole(
	rest: REST,
	guildId: string,
	userId: string,
	roleId: string,
): Promise<void> {
	try {
		await rest.delete(Routes.guildMemberRole(guildId, userId, roleId), {
			reason: "Mute expired",
		});
	} catch (error) {
		if (statusOf(error) === 404) return;
		throw error;
	}
}

export async function postMessage(
	rest: REST,
	channelId: string,
	body: { content?: string; embeds?: DiscordEmbed[] },
): Promise<{ id: string }> {
	return (await rest.post(Routes.channelMessages(channelId), { body })) as {
		id: string;
	};
}

export async function editMessage(
	rest: REST,
	channelId: string,
	messageId: string,
	body: { content?: string; embeds?: DiscordEmbed[] },
): Promise<void> {
	await rest.patch(Routes.channelMessage(channelId, messageId), { body });
}

/** Best-effort DM. Returns false when the user has DMs closed or blocked the bot. */
export async function dmUser(
	rest: REST,
	userId: string,
	body: { content?: string; embeds?: DiscordEmbed[] },
): Promise<boolean> {
	try {
		const dm = (await rest.post(Routes.userChannels(), {
			body: { recipient_id: userId },
		})) as { id: string };
		await rest.post(Routes.channelMessages(dm.id), { body });
		return true;
	} catch {
		return false;
	}
}

/** Post an embed to the guild's configured mod-log channel, if one is set. */
export async function sendModLog(
	rest: REST,
	settingsRepo: GuildSettingsRepository,
	guildId: string,
	embed: DiscordEmbed,
): Promise<void> {
	const settings = await settingsRepo.findByGuild(guildId);
	if (!settings?.logChannelId) return;
	await postMessage(rest, settings.logChannelId, { embeds: [embed] });
}
