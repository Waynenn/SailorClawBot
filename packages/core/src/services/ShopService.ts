import type {
	CreateItemDto,
	InventoryItemDto,
	InventoryItemRepository,
	ItemDto,
	ItemRepository,
	SnowflakeId,
	TransactionRepository,
	WalletRepository,
} from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import type { EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";

export interface ShopSettings {
	shopTaxPercent: number;
}

export interface BuyResult {
	wallet: { balance: bigint };
	item: ItemDto;
	totalPaid: bigint;
	inventoryItem: InventoryItemDto;
}

export interface SellResult {
	balance: bigint;
	item: ItemDto;
	refund: bigint;
}

export class ShopService {
	public constructor(
		private readonly items: ItemRepository,
		private readonly inventory: InventoryItemRepository,
		private readonly wallets: WalletRepository,
		private readonly transactions: TransactionRepository,
		private readonly bus: EventBus,
		private readonly logger: Logger,
	) {}

	public async listItems(guildId: SnowflakeId): Promise<ItemDto[]> {
		return this.items.findByGuild(guildId);
	}

	public async buyItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
		settings: ShopSettings,
	): Promise<BuyResult> {
		const item = await this.items.findById(itemId);
		if (!item || item.guildId !== guildId)
			throw new NotFoundError("Item", itemId);

		const tax = (item.price * BigInt(settings.shopTaxPercent)) / 100n;
		const totalPaid = item.price + tax;

		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);

		// Reserve the funds atomically up front so concurrent buys can't overspend
		// into a negative balance (a non-atomic check + adjustBalance would race).
		const debited = await this.wallets.tryDebit(wallet.id, totalPaid);
		if (!debited)
			throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");

		// Atomically decrement stock — prevents overselling when concurrent buyers race.
		// Uses updateMany(WHERE stock > 0) so the check and decrement are one DB round-trip.
		if (item.stock !== null) {
			const available = await this.items.decrementStockIfAvailable(itemId);
			if (!available) {
				// Out of stock after debiting — refund the reserved funds.
				await this.wallets.adjustBalance(wallet.id, totalPaid);
				throw new ConflictError("Item is out of stock", "OUT_OF_STOCK");
			}
		}

		const updatedWallet = debited;
		const inventoryItem = await this.inventory.addItem(guildId, userId, itemId);
		await this.transactions.create({
			walletId: wallet.id,
			amount: -totalPaid,
			reason: `Buy: ${item.name}`,
		});

		this.logger.info("Item bought", {
			guildId,
			userId,
			itemId,
			totalPaid: totalPaid.toString(),
		});

		return {
			wallet: { balance: updatedWallet.balance },
			item,
			totalPaid,
			inventoryItem,
		};
	}

	public async sellItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<SellResult> {
		const invItem = await this.inventory.findByUserAndItem(
			guildId,
			userId,
			itemId,
		);
		if (!invItem)
			throw new NotFoundError(
				"InventoryItem",
				`${guildId}:${userId}:${itemId}`,
			);

		const item = invItem.item ?? (await this.items.findById(itemId));
		if (!item) throw new NotFoundError("Item", itemId);

		const refund = item.price / 2n;
		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);

		// Remove one unit atomically BEFORE crediting — this is the gate that stops
		// concurrent sells of the same item from each being refunded (duplication).
		const removed = await this.inventory.consumeOne(guildId, userId, itemId);
		if (!removed)
			throw new NotFoundError(
				"InventoryItem",
				`${guildId}:${userId}:${itemId}`,
			);

		let newBalance = wallet.balance;
		if (refund > 0n) {
			const updated = await this.wallets.adjustBalance(wallet.id, refund);
			await this.transactions.create({
				walletId: wallet.id,
				amount: refund,
				reason: `Sell: ${item.name}`,
			});
			newBalance = updated.balance;
		}

		this.logger.info("Item sold", {
			guildId,
			userId,
			itemId,
			refund: refund.toString(),
		});
		return { balance: newBalance, item, refund };
	}

	public async createItem(
		guildId: SnowflakeId,
		data: Omit<CreateItemDto, "guildId">,
	): Promise<ItemDto> {
		return this.items.create({ ...data, guildId });
	}

	public async deleteItem(guildId: SnowflakeId, itemId: string): Promise<void> {
		const item = await this.items.findById(itemId);
		if (!item || item.guildId !== guildId)
			throw new NotFoundError("Item", itemId);
		await this.items.delete(itemId);
	}
}
