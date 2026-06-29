import type { PrismaClient } from "@prisma/client";
import type {
	AutoModRepository,
	AutoModRuleDto,
} from "@sailorclawbot/contracts";

export class AutoModRepositoryImpl implements AutoModRepository {
	public constructor(private readonly prisma: PrismaClient) {}

	public async findAllByGuild(guildId: string): Promise<AutoModRuleDto[]> {
		const rows = await this.prisma.autoModRule.findMany({ where: { guildId } });
		return rows.map((r) => ({
			id: r.id,
			guildId: r.guildId,
			type: r.type as AutoModRuleDto["type"],
			enabled: r.enabled,
			config: r.config as unknown as AutoModRuleDto["config"],
		}));
	}

	public async upsert(
		guildId: string,
		type: string,
		enabled: boolean,
		config: Record<string, unknown>,
	): Promise<AutoModRuleDto> {
		const prismaConfig = config as Parameters<
			typeof this.prisma.autoModRule.upsert
		>[0]["create"]["config"];
		const row = await this.prisma.autoModRule.upsert({
			where: { guildId_type: { guildId, type } },
			update: { enabled, config: prismaConfig },
			create: { guildId, type, enabled, config: prismaConfig },
		});
		return {
			id: row.id,
			guildId: row.guildId,
			type: row.type as AutoModRuleDto["type"],
			enabled: row.enabled,
			config: row.config as unknown as AutoModRuleDto["config"],
		};
	}
}
