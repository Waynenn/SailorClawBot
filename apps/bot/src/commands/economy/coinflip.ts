import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const coinflipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin — double your bet or lose it')
    .addStringOption((o) =>
      o.setName('choice').setDescription('heads or tails').setRequired(true)
        .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
    )
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const choice = interaction.options.getString('choice', true) as 'heads' | 'tails';
    const amount = BigInt(interaction.options.getInteger('amount', true));

    try {
      const settings = await container.guildSettingsRepo.findByGuild(guildId);
      const { won, result, wallet } = await container.economyService.coinflip(guildId, userId, choice, amount, {
        gamblingMinBet: settings?.gamblingMinBet ?? 10n,
        gamblingMaxBet: settings?.gamblingMaxBet ?? 50000n,
      });

      const embed = new EmbedBuilder()
        .setColor(won ? EMBED_COLORS.economy : EMBED_COLORS.punitive)
        .setTitle(`Coin Flip — ${result === 'heads' ? '🪙 Heads' : '🪙 Tails'}`)
        .setDescription(
          won
            ? `You chose **${choice}**, it landed **${result}** — you won **+${amount.toLocaleString()} coins**!`
            : `You chose **${choice}**, it landed **${result}** — you lost **${amount.toLocaleString()} coins**.`
        )
        .addFields({ name: 'Balance', value: `${wallet.balance.toLocaleString()} coins`, inline: true });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
