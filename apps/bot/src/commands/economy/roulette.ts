import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

const COLOR_EMOJI: Record<string, string> = { red: '🔴', black: '⚫', green: '🟢' };

export const rouletteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Bet on roulette')
    .addStringOption((o) =>
      o.setName('bet').setDescription('red, black, even, odd, or a number 0-36').setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const bet = interaction.options.getString('bet', true);
    const amount = BigInt(interaction.options.getInteger('amount', true));

    try {
      const settings = await container.guildSettingsRepo.findByGuild(guildId);
      const { number, color, won, payout, multiplier, wallet } = await container.economyService.roulette(
        guildId, userId, bet, amount,
        { gamblingMinBet: settings?.gamblingMinBet ?? 10n, gamblingMaxBet: settings?.gamblingMaxBet ?? 50000n }
      );

      const emoji = COLOR_EMOJI[color];
      const embed = new EmbedBuilder()
        .setColor(won ? EMBED_COLORS.economy : EMBED_COLORS.punitive)
        .setTitle(`Roulette — ${emoji} ${number}`)
        .setDescription(
          won
            ? `The ball landed on **${number}** (${color})! You won **+${(payout - amount).toLocaleString()} coins** (${multiplier}x)!`
            : `The ball landed on **${number}** (${color}). You lost **${amount.toLocaleString()} coins**.`
        )
        .addFields({ name: 'Balance', value: `${wallet.balance.toLocaleString()} coins`, inline: true });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
