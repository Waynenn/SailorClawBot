import type { ChatInputCommandInteraction } from "discord.js";
import type { Container } from "../container.js";

export interface Command {
	data: { name: string; toJSON(): object };
	execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void>;
}
