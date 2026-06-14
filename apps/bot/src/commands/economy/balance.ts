import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const balanceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance or another member\'s')
    .addUserOption((o) => o.setName('user').setDescription('Member to check (defaults to you)')),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user') ?? interaction.user;
    const guildId = interaction.guildId!;

    try {
      const wallet = await container.economyService.ensureWallet(guildId, target.id);
      const isSelf = target.id === interaction.user.id;
      await interaction.editReply(
        isSelf
          ? `💰 Your balance: **${wallet.balance.toLocaleString()}** coins`
          : `💰 **${target.tag}**'s balance: **${wallet.balance.toLocaleString()}** coins`
      );
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
