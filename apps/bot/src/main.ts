import { startAutoModCleanup } from "@sailorclawbot/core";
import * as Sentry from "@sentry/node";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { balanceCommand } from "./commands/economy/balance.js";
import {
	blackjackCommand,
	refundAllSessions,
	startSessionCleaner,
} from "./commands/economy/blackjack.js";
import { buyCommand } from "./commands/economy/buy.js";
import { coinflipCommand } from "./commands/economy/coinflip.js";
import { crimeCommand } from "./commands/economy/crime.js";
import { dailyCommand } from "./commands/economy/daily.js";
import { inventoryCommand } from "./commands/economy/inventory.js";
import { robCommand } from "./commands/economy/rob.js";
import { rouletteCommand } from "./commands/economy/roulette.js";
import { sellCommand } from "./commands/economy/sell.js";
import { shopCommand } from "./commands/economy/shop.js";
import { slotsCommand } from "./commands/economy/slots.js";
import { transferCommand } from "./commands/economy/transfer.js";
import { workCommand } from "./commands/economy/work.js";
import { familyCommand } from "./commands/family/family.js";
import type { Command } from "./commands/index.js";
import { automodCommand } from "./commands/moderation/automod.js";
import { banCommand } from "./commands/moderation/ban.js";
import { casesCommand } from "./commands/moderation/cases.js";
import { kickCommand } from "./commands/moderation/kick.js";
import { lockdownCommand } from "./commands/moderation/lockdown.js";
import { muteCommand } from "./commands/moderation/mute.js";
import { noteCommand } from "./commands/moderation/note.js";
import { purgeCommand } from "./commands/moderation/purge.js";
import { slowmodeCommand } from "./commands/moderation/slowmode.js";
import { softbanCommand } from "./commands/moderation/softban.js";
import { unbanCommand } from "./commands/moderation/unban.js";
import { unlockCommand } from "./commands/moderation/unlock.js";
import { unmuteCommand } from "./commands/moderation/unmute.js";
import { warnCommand } from "./commands/moderation/warn.js";
import { profileCommand } from "./commands/profile/profile.js";
import { giveawayCommand } from "./commands/servermgmt/giveaway.js";
import { logCommand } from "./commands/servermgmt/log.js";
import { reactionroleCommand } from "./commands/servermgmt/reactionrole.js";
import { starboardCommand } from "./commands/servermgmt/starboard.js";
import { welcomeCommand } from "./commands/servermgmt/welcome.js";
import { ticketCommand } from "./commands/tickets/ticket.js";
import { twitchCommand } from "./commands/twitch/twitch.js";
import { leaderboardCommand } from "./commands/xp/leaderboard.js";
import { rankCommand } from "./commands/xp/rank.js";
import { xpCommand } from "./commands/xp/xp.js";
import { getContainer } from "./container.js";
import { registerGuildCreateHandler } from "./events/guildCreate.js";
import { registerGuildDeleteHandler } from "./events/guildDelete.js";
import { registerGuildMemberAddHandler } from "./events/guildMemberAdd.js";
import { registerGuildMemberRemoveHandler } from "./events/guildMemberRemove.js";
import { registerInteractionHandler } from "./events/interactionCreate.js";
import { registerLoggingHandlers } from "./events/logging.js";
import { registerMessageCreateHandler } from "./events/messageCreate.js";
import { registerMessageReactionAddHandler } from "./events/messageReactionAdd.js";
import { registerMessageReactionRemoveHandler } from "./events/messageReactionRemove.js";
import { registerReadyHandler } from "./events/ready.js";
import { TwitchPoller } from "./lib/TwitchPoller.js";
import { startTicketCleaner } from "./lib/ticketHelper.js";

const ALL_COMMANDS: Command[] = [
	warnCommand,
	muteCommand,
	unmuteCommand,
	banCommand,
	unbanCommand,
	kickCommand,
	casesCommand,
	balanceCommand,
	transferCommand,
	dailyCommand,
	workCommand,
	crimeCommand,
	robCommand,
	coinflipCommand,
	slotsCommand,
	rouletteCommand,
	blackjackCommand,
	shopCommand,
	buyCommand,
	sellCommand,
	inventoryCommand,
	ticketCommand,
	profileCommand,
	rankCommand,
	leaderboardCommand,
	xpCommand,
	twitchCommand,
	automodCommand,
	purgeCommand,
	slowmodeCommand,
	lockdownCommand,
	unlockCommand,
	softbanCommand,
	noteCommand,
	welcomeCommand,
	logCommand,
	reactionroleCommand,
	starboardCommand,
	giveawayCommand,
	familyCommand,
];

export async function startBot(): Promise<void> {
	if (process.env.SENTRY_DSN) {
		Sentry.init({
			dsn: process.env.SENTRY_DSN,
			environment: process.env.NODE_ENV ?? "production",
		});
	}

	const token = process.env.DISCORD_TOKEN;
	if (!token) throw new Error("DISCORD_TOKEN is not set");

	const container = getContainer();
	const { logger, guildService } = container;

	const client = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.GuildModeration,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.GuildMessageReactions,
			GatewayIntentBits.GuildVoiceStates,
		],
		partials: [Partials.Message, Partials.Reaction, Partials.User],
	});

	const commands = new Collection<string, Command>();
	for (const cmd of ALL_COMMANDS) {
		commands.set(cmd.data.name, cmd);
	}

	registerReadyHandler(client, logger);
	registerGuildCreateHandler(client, guildService, logger);
	registerGuildDeleteHandler(client, logger);
	registerInteractionHandler(client, commands, container, logger);
	registerMessageCreateHandler(client, container);
	registerGuildMemberAddHandler(client, container);
	registerGuildMemberRemoveHandler(client, container);
	registerMessageReactionAddHandler(client, container);
	registerMessageReactionRemoveHandler(client, container);
	registerLoggingHandlers(client, container);

	// Twitch poller (only if credentials configured)
	const twitchClientId = process.env.TWITCH_CLIENT_ID;
	const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
	if (twitchClientId && twitchClientSecret) {
		const poller = new TwitchPoller(
			client,
			container.twitchSubRepo,
			logger,
			twitchClientId,
			twitchClientSecret,
		);
		client.once("ready", () => poller.start());
		logger.info("Twitch poller enabled");
	} else {
		logger.warn(
			"TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set — Twitch notifications disabled",
		);
	}

	startSessionCleaner(container);
	startAutoModCleanup();
	startTicketCleaner(client, container);

	// Graceful shutdown: refund any in-flight blackjack bets before exiting so a
	// deploy/restart doesn't silently burn player stakes held in memory.
	let shuttingDown = false;
	const shutdown = async (signal: string): Promise<void> => {
		if (shuttingDown) return;
		shuttingDown = true;
		logger.info("Shutting down", { signal });
		try {
			await refundAllSessions(container);
		} catch (err) {
			Sentry.captureException(err);
		}
		await client.destroy();
		process.exit(0);
	};
	process.once("SIGINT", () => void shutdown("SIGINT"));
	process.once("SIGTERM", () => void shutdown("SIGTERM"));

	await client.login(token);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	startBot().catch((err) => {
		Sentry.captureException(err);
		console.error("Fatal error:", err);
		process.exit(1);
	});
}
