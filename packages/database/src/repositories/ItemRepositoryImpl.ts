import type { PrismaClient } from "@prisma/client";
import type {
	CreateItemDto,
	ItemDto,
	ItemRepository,
	SnowflakeId,
} from "@sailorclawbot/contracts";
import { toItemDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class ItemRepositoryImpl implements ItemRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findById(id: string): Promise<ItemDto | null> {
		const row = await this.db.item.findUnique({ where: { id } });
		return row ? toItemDto(row) : null;
	}

	public async findByGuild(guildId: SnowflakeId): Promise<ItemDto[]> {
		const rows = await this.db.item.findMany({
			where: { guildId },
			orderBy: { price: "asc" },
		});
		return rows.map(toItemDto);
	}

	public async create(data: CreateItemDto): Promise<ItemDto> {
		try {
			const row = await this.db.item.create({
				data: {
					guildId: data.guildId,
					name: data.name,
					description: data.description ?? null,
					price: data.price,
					emoji: data.emoji ?? null,
					type: data.type,
					effect: data.effect ?? undefined,
					stock: data.stock ?? null,
				},
			});
			return toItemDto(row);
		} catch (error) {
			translatePrismaError(error, "create item");
		}
	}

	public async update(
		id: string,
		data: Partial<
			Pick<
				ItemDto,
				"name" | "description" | "price" | "emoji" | "type" | "effect" | "stock"
			>
		>,
	): Promise<ItemDto> {
		try {
			const row = await this.db.item.update({
				where: { id },
				data: {
					...(data.name !== undefined && { name: data.name }),
					...(data.description !== undefined && {
						description: data.description,
					}),
					...(data.price !== undefined && { price: data.price }),
					...(data.emoji !== undefined && { emoji: data.emoji }),
					...(data.type !== undefined && { type: data.type }),
					...(data.stock !== undefined && { stock: data.stock }),
					...("effect" in data && { effect: (data.effect as object) ?? null }),
				},
			});
			return toItemDto(row);
		} catch (error) {
			translatePrismaError(error, "update item");
		}
	}

	public async delete(id: string): Promise<void> {
		try {
			await this.db.item.delete({ where: { id } });
		} catch (error) {
			translatePrismaError(error, "delete item");
		}
	}

	public async decrementStockIfAvailable(id: string): Promise<boolean> {
		const result = await this.db.item.updateMany({
			where: { id, stock: { gt: 0 } },
			data: { stock: { decrement: 1 } },
		});
		return result.count > 0;
	}
}
