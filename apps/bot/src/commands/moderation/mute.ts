import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const muteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member for a set duration')
    .addUserOption((o) => o.setName('user').setDescription('Member to mute').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption((o) => o.setName('reason').setDescription('Reason for mute')),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') ?? undefined;
    const guildId = interaction.guildId!;
    const moderatorId = interaction.user.id;

    try {
      const mute = await container.moderationService.muteUser(guildId, target.id, duration, moderatorId, reason);
      const until = mute.expiresAt instanceof Date
        ? `<t:${Math.floor(mute.expiresAt.getTime() / 1000)}:R>`
        : String(mute.expiresAt);
      await interaction.editReply(
        `🔇 **${target.tag}** has been muted until ${until} (case #${mute.caseNumber}).${reason ? `\nReason: ${reason}` : ''}`
      );
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
