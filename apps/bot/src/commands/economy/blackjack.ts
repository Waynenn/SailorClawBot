import type { ChatInputCommandInteraction } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

// ─── Types & shared session state ────────────────────────────────────────────

export interface Card {
	rank: string;
	suit: string;
	value: number;
}

export interface BlackjackSession {
	id: string;
	guildId: string;
	userId: string;
	walletId: string;
	bet: bigint;
	playerCards: Card[];
	dealerCards: Card[];
	deck: Card[];
	createdAt: number;
}

export const bjSessions = new Map<string, BlackjackSession>();

const SESSION_TTL_MS = 15 * 60 * 1000;

// Return an abandoned bet to the player. The bet was debited at deal time, so a
// session that is dropped without resolving (TTL expiry or shutdown) must refund
// it — otherwise the stake is silently lost.
async function refundSession(
	container: Container,
	session: BlackjackSession,
	reason: string,
): Promise<void> {
	await container.economyService.deposit(
		session.guildId,
		session.userId,
		session.bet,
		reason,
	);
}

export function startSessionCleaner(container: Container): void {
	setInterval(
		() => {
			const cutoff = Date.now() - SESSION_TTL_MS;
			for (const [key, session] of bjSessions) {
				// Map.delete returns true only for the caller that actually removed the
				// entry, so a concurrent resolve and this cleaner can't double-refund.
				if (session.createdAt < cutoff && bjSessions.delete(key)) {
					void refundSession(
						container,
						session,
						"Blackjack refund (session expired)",
					).catch(() => null);
				}
			}
		},
		5 * 60 * 1000,
	).unref();
}

// Refund every in-flight bet on graceful shutdown so a deploy/restart doesn't
// burn stakes held only in this in-memory map.
export async function refundAllSessions(container: Container): Promise<void> {
	const pending = [...bjSessions.values()];
	bjSessions.clear();
	await Promise.allSettled(
		pending.map((s) =>
			refundSession(container, s, "Blackjack refund (bot shutdown)"),
		),
	);
}

// ─── Card helpers ─────────────────────────────────────────────────────────────

const RANKS = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];
const SUITS = ["♠", "♥", "♦", "♣"];

function buildDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			const value =
				rank === "A"
					? 1
					: ["J", "Q", "K"].includes(rank)
						? 10
						: parseInt(rank, 10);
			deck.push({ rank, suit, value });
		}
	}
	return deck.sort(() => Math.random() - 0.5);
}

export function handValue(cards: Card[]): number {
	let sum = 0;
	let aces = 0;
	for (const c of cards) {
		sum += c.value;
		if (c.rank === "A") aces++;
	}
	while (aces > 0 && sum + 10 <= 21) {
		sum += 10;
		aces--;
	}
	return sum;
}

export function renderHand(cards: Card[], hideSecond = false): string {
	return cards
		.map((c, i) => (hideSecond && i === 1 ? "🂠" : `${c.rank}${c.suit}`))
		.join(" ");
}

export function dealerPlay(session: BlackjackSession): void {
	while (handValue(session.dealerCards) < 17) {
		session.dealerCards.push(session.deck.pop()!);
	}
}

export function buildBjEmbed(
	session: BlackjackSession,
	opts: { hideDealer?: boolean; footer?: string } = {},
): EmbedBuilder {
	const playerVal = handValue(session.playerCards);
	const dealerVal = opts.hideDealer ? "?" : handValue(session.dealerCards);
	return new EmbedBuilder()
		.setColor(EMBED_COLORS.economy)
		.setTitle("Blackjack")
		.addFields(
			{
				name: `Dealer (${dealerVal})`,
				value: renderHand(session.dealerCards, opts.hideDealer),
				inline: false,
			},
			{
				name: `Your hand (${playerVal})`,
				value: renderHand(session.playerCards),
				inline: false,
			},
			{
				name: "Bet",
				value: `${session.bet.toLocaleString()} coins`,
				inline: true,
			},
		)
		.setFooter({ text: opts.footer ?? "Hit, Stand, or Double Down" });
}

export function bjButtons(
	userId: string,
	canDouble: boolean,
): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`bj_hit_${userId}`)
			.setLabel("Hit")
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`bj_stand_${userId}`)
			.setLabel("Stand")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`bj_double_${userId}`)
			.setLabel("Double Down")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(!canDouble),
	);
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const blackjackCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("blackjack")
		.setDescription("Play a hand of blackjack")
		.addIntegerOption((o) =>
			o
				.setName("amount")
				.setDescription("Amount to bet")
				.setRequired(true)
				.setMinValue(1),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply();
		const guildId = interaction.guildId!;
		const userId = interaction.user.id;
		const amount = BigInt(interaction.options.getInteger("amount", true));

		try {
			const settings = await container.guildSettingsRepo.findByGuild(guildId);
			const minBet = settings?.gamblingMinBet ?? 10n;
			const maxBet = settings?.gamblingMaxBet ?? 50000n;

			if (amount < minBet) {
				await interaction.editReply(
					`Minimum bet is **${minBet.toLocaleString()} coins**.`,
				);
				return;
			}
			if (amount > maxBet) {
				await interaction.editReply(
					`Maximum bet is **${maxBet.toLocaleString()} coins**.`,
				);
				return;
			}

			const sessionKey = `bj_${guildId}_${userId}`;
			if (bjSessions.has(sessionKey)) {
				await interaction.editReply(
					"You already have an active blackjack game! Finish it first.",
				);
				return;
			}

			const wallet = await container.economyService.ensureWallet(
				guildId,
				userId,
			);
			if (wallet.balance < amount) {
				await interaction.editReply(
					`Insufficient balance. You have **${wallet.balance.toLocaleString()} coins**.`,
				);
				return;
			}

			await container.economyService.withdraw(
				guildId,
				userId,
				amount,
				"Blackjack bet",
			);

			const deck = buildDeck();
			const session: BlackjackSession = {
				id: sessionKey,
				guildId,
				userId,
				walletId: wallet.id,
				bet: amount,
				playerCards: [deck.pop()!, deck.pop()!],
				dealerCards: [deck.pop()!, deck.pop()!],
				deck,
				createdAt: Date.now(),
			};

			const playerVal = handValue(session.playerCards);
			if (playerVal === 21) {
				dealerPlay(session);
				const dealerVal = handValue(session.dealerCards);
				const dealerBlackjack =
					dealerVal === 21 && session.dealerCards.length === 2;

				if (dealerBlackjack) {
					// Push — return original bet only
					await container.economyService.deposit(
						guildId,
						userId,
						amount,
						"Blackjack push",
					);
					const embed = buildBjEmbed(session, {
						footer: "Push — both blackjack!",
					});
					await interaction.editReply({ embeds: [embed] });
				} else {
					// Natural blackjack pays 3:2: profit = 1.5x bet
					const winnings = (amount * 3n) / 2n;
					await container.economyService.deposit(
						guildId,
						userId,
						amount + winnings,
						"Blackjack! 3:2",
					);
					const embed = buildBjEmbed(session, {
						footer: `Blackjack! You won +${winnings.toLocaleString()} coins!`,
					});
					await interaction.editReply({ embeds: [embed] });
				}
				return;
			}

			bjSessions.set(session.id, session);
			const canDouble = wallet.balance - amount >= amount;
			const embed = buildBjEmbed(session, { hideDealer: true });
			await interaction.editReply({
				embeds: [embed],
				components: [bjButtons(userId, canDouble)],
			});
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
