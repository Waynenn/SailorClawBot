/**
 * Pick up to `count` distinct winners from `participants` using a partial
 * Fisher–Yates shuffle. Shared by GiveawayService (manual end/reroll) and the
 * worker's ProcessGiveawayEnd job — single source of truth for the draw.
 */
export function pickWinners(
	participants: readonly string[],
	count: number,
): string[] {
	if (participants.length === 0 || count < 1) return [];
	const pool = [...participants];
	const winners: string[] = [];
	const take = Math.min(count, pool.length);
	for (let i = 0; i < take; i++) {
		const idx = Math.floor(Math.random() * (pool.length - i));
		winners.push(pool[idx]);
		pool[idx] = pool[pool.length - 1 - i];
	}
	return winners;
}
