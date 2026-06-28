import { Prisma, type PrismaClient } from "@prisma/client";
import type {
	BlackjackSessionDto,
	BlackjackSessionRepository,
} from "@sailorclawbot/contracts";
import { toBlackjackSessionDto } from "./mappers.js";

type JsonValue = Prisma.InputJsonValue;

export class BlackjackSessionRepositoryImpl
	implements BlackjackSessionRepository
{
	public constructor(private readonly prisma: PrismaClient) {}

	public async findById(id: string): Promise<BlackjackSessionDto | null> {
		const row = await this.prisma.blackjackSession.findUnique({
			where: { id },
		});
		return row ? toBlackjackSessionDto(row) : null;
	}

	public async create(
		input: Omit<BlackjackSessionDto, "createdAt">,
	): Promise<BlackjackSessionDto> {
		const row = await this.prisma.blackjackSession.create({
			data: {
				id: input.id,
				guildId: input.guildId,
				userId: input.userId,
				walletId: input.walletId,
				bet: input.bet,
				playerCards: input.playerCards as unknown as JsonValue,
				dealerCards: input.dealerCards as unknown as JsonValue,
				deck: input.deck as unknown as JsonValue,
			},
		});
		return toBlackjackSessionDto(row);
	}

	public async update(
		id: string,
		data: Partial<
			Pick<BlackjackSessionDto, "playerCards" | "dealerCards" | "deck" | "bet">
		>,
	): Promise<BlackjackSessionDto> {
		const row = await this.prisma.blackjackSession.update({
			where: { id },
			data: {
				...(data.bet !== undefined && { bet: data.bet }),
				...(data.playerCards !== undefined && {
					playerCards: data.playerCards as unknown as JsonValue,
				}),
				...(data.dealerCards !== undefined && {
					dealerCards: data.dealerCards as unknown as JsonValue,
				}),
				...(data.deck !== undefined && {
					deck: data.deck as unknown as JsonValue,
				}),
			},
		});
		return toBlackjackSessionDto(row);
	}

	public async deleteCapture(
		id: string,
	): Promise<BlackjackSessionDto | null> {
		try {
			// delete returns the removed row; a concurrent loser hits P2025 → null,
			// so exactly one caller captures the session and credits the bet.
			const row = await this.prisma.blackjackSession.delete({ where: { id } });
			return toBlackjackSessionDto(row);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				return null;
			}
			throw error;
		}
	}

	public async findAll(): Promise<BlackjackSessionDto[]> {
		const rows = await this.prisma.blackjackSession.findMany();
		return rows.map(toBlackjackSessionDto);
	}

	public async findStale(cutoff: Date): Promise<BlackjackSessionDto[]> {
		const rows = await this.prisma.blackjackSession.findMany({
			where: { createdAt: { lt: cutoff } },
		});
		return rows.map(toBlackjackSessionDto);
	}
}
