import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const dailyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coin reward'),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    try {
      const settings = await container.guildSettingsRepo.findByGuild(guildId);
      const dailyAmount = settings?.dailyAmount ?? 100n;

      const { wallet, amount } = await container.economyService.claimDaily(guildId, userId, { dailyAmount });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.economy)
        .setTitle('Daily Reward')
        .setDescription(`You claimed your daily **+${amount.toLocaleString()} coins**!`)
        .addFields({ name: 'New Balance', value: `${wallet.balance.toLocaleString()} coins`, inline: true })
        .setFooter({ text: 'Come back in 24 hours for your next reward' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
