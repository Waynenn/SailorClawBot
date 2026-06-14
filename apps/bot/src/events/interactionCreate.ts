import type { Client, Interaction } from 'discord.js';
import type { Command } from '../commands/index.js';
import type { Container } from '../container.js';
import type { Logger } from '@sailorclawbot/core';

export function registerInteractionHandler(
  client: Client,
  commands: Map<string, Command>,
  container: Container,
  logger: Logger
): void {
  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Commands only work inside a server.', ephemeral: true });
      return;
    }

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, container);
    } catch (error) {
      logger.error('Unhandled command error', { command: interaction.commandName, error: String(error) });
      const msg = '💥 An unexpected error occurred.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });
}
