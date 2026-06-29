import type { TwitchSubscriptionRepository } from "@sailorclawbot/contracts";
import type { Logger } from "@sailorclawbot/core";
import type { Client } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { EMBED_COLORS } from "./embedColors.js";

interface TwitchStream {
	id: string;
	user_login: string;
	user_name: string;
	game_name: string;
	title: string;
	thumbnail_url: string;
}

interface TwitchTokenResponse {
	access_token: string;
}

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const TWITCH_API = "https://api.twitch.tv/helix";
const TWITCH_AUTH = "https://id.twitch.tv/oauth2/token";

export class TwitchPoller {
	private token: string | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;

	public constructor(
		private readonly client: Client,
		private readonly repo: TwitchSubscriptionRepository,
		private readonly logger: Logger,
		private readonly clientId: string,
		private readonly clientSecret: string,
	) {}

	public start(): void {
		this.poll().catch((e) =>
			this.logger.error("TwitchPoller initial poll failed", {
				error: String(e),
			}),
		);
		this.timer = setInterval(() => {
			this.poll().catch((e) =>
				this.logger.error("TwitchPoller poll failed", { error: String(e) }),
			);
		}, POLL_INTERVAL_MS);
	}

	public stop(): void {
		if (this.timer) clearInterval(this.timer);
	}

	private async getToken(): Promise<string> {
		if (this.token) return this.token;
		const res = await fetch(
			`${TWITCH_AUTH}?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`,
			{
				method: "POST",
			},
		);
		if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`);
		const data = (await res.json()) as TwitchTokenResponse;
		this.token = data.access_token;
		return this.token;
	}

	private async fetchLiveStreams(
		logins: string[],
		retried = false,
	): Promise<TwitchStream[]> {
		if (logins.length === 0) return [];
		const token = await this.getToken();
		const params = logins
			.map((l) => `user_login=${encodeURIComponent(l)}`)
			.join("&");
		const res = await fetch(`${TWITCH_API}/streams?${params}`, {
			headers: {
				"Client-Id": this.clientId,
				Authorization: `Bearer ${token}`,
			},
		});
		if (res.status === 401) {
			if (retried)
				throw new Error(
					"Twitch token invalid after refresh — check TWITCH_CLIENT_ID/SECRET",
				);
			this.token = null;
			return this.fetchLiveStreams(logins, true);
		}
		if (!res.ok) throw new Error(`Twitch streams API failed: ${res.status}`);
		const data = (await res.json()) as { data: TwitchStream[] };
		return data.data;
	}

	private async poll(): Promise<void> {
		const subs = await this.repo.findAll();
		if (subs.length === 0) return;

		const logins = subs.map((s) => s.twitchLogin);
		const liveStreams = await this.fetchLiveStreams(logins);
		const liveMap = new Map(
			liveStreams.map((s) => [s.user_login.toLowerCase(), s]),
		);

		for (const sub of subs) {
			const stream = liveMap.get(sub.twitchLogin.toLowerCase());
			if (!stream) continue;
			// Already notified for this stream session
			if (sub.lastStreamId === stream.id) continue;

			await this.repo.updateLastStreamId(sub.id, stream.id);
			await this.sendNotification(sub, stream);
		}
	}

	private async sendNotification(
		sub: {
			notifyChannelId: string;
			mentionRoleId: string | null;
			customMessage: string | null;
			twitchLogin: string;
		},
		stream: TwitchStream,
	): Promise<void> {
		const channel = await this.client.channels
			.fetch(sub.notifyChannelId)
			.catch(() => null);
		if (!channel?.isTextBased()) return;

		const streamUrl = `https://twitch.tv/${stream.user_login}`;
		const thumbnail = stream.thumbnail_url
			.replace("{width}", "320")
			.replace("{height}", "180");

		const defaultMsg = `🔴 **{streamer}** стримит **{game}**!\n{url}`;
		const template = sub.customMessage ?? defaultMsg;
		const content = template
			.replace("{streamer}", stream.user_name)
			.replace("{title}", stream.title)
			.replace("{game}", stream.game_name || "Unknown")
			.replace("{url}", streamUrl);

		const embed = new EmbedBuilder()
			.setColor(EMBED_COLORS.info)
			.setTitle(stream.title || `${stream.user_name} в эфире!`)
			.setURL(streamUrl)
			.setAuthor({ name: stream.user_name, url: streamUrl })
			.addFields({
				name: "Игра",
				value: stream.game_name || "Unknown",
				inline: true,
			})
			.setImage(thumbnail)
			.setFooter({ text: "Twitch" });

		const mention = sub.mentionRoleId ? `<@&${sub.mentionRoleId}> ` : "";
		await (channel as import("discord.js").TextChannel)
			.send({
				content: `${mention}${content}`,
				embeds: [embed],
			})
			.catch((e) =>
				this.logger.error("Failed to send Twitch notification", {
					error: String(e),
				}),
			);
	}
}
