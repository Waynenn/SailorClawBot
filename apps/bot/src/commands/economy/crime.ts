import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

const SUCCESS_MESSAGES = [
  'You pickpocketed a wealthy merchant',
  'You hacked into a corporate server',
  'You forged some documents',
  'You ran a scam on the dark web',
  'You robbed a convenience store',
];

const FAIL_MESSAGES = [
  'You got caught pickpocketing — the police fined you',
  'Your hack was traced back to you',
  'The forgery was spotted and you were fined',
  'Your scam victim reported you',
  'The store alarm went off and you were caught',
];

export const crimeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Attempt a crime for big rewards — or get caught (2h cooldown)'),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    try {
      const settings = await container.guildSettingsRepo.findByGuild(guildId);
      const { success, amount, wallet } = await container.economyService.crime(guildId, userId, {
        crimeMin: settings?.crimeMin ?? 100n,
        crimeMax: settings?.crimeMax ?? 500n,
        dailyCrimeLimit: settings?.dailyCrimeLimit ?? 3,
        crimeDiminishingFactor: settings?.crimeDiminishingFactor ?? 0.7,
      });

      const messages = success ? SUCCESS_MESSAGES : FAIL_MESSAGES;
      const msg = messages[Math.floor(Math.random() * messages.length)];

      const embed = new EmbedBuilder()
        .setColor(success ? EMBED_COLORS.economy : EMBED_COLORS.punitive)
        .setTitle(success ? 'Crime Successful' : 'Caught!')
        .setDescription(
          success
            ? `${msg} and got away with **+${amount.toLocaleString()} coins**!`
            : `${msg}. You were fined **${amount.toLocaleString()} coins**.`
        )
        .addFields({ name: 'Balance', value: `${wallet.balance.toLocaleString()} coins`, inline: true })
        .setFooter({ text: 'Cooldown: 2 hours' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
