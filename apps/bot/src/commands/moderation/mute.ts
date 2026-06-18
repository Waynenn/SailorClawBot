import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const muteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member for a set duration')
    .addUserOption((o) => o.setName('user').setDescription('Member to mute').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption((o) => o.setName('reason').setDescription('Reason for mute'))
    .setDefaultMemberPermissions(0n),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') ?? undefined;
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const moderatorId = interaction.user.id;
    const selfMember = interaction.member as GuildMember;

    const canMute = await container.permissionService.hasPermission(
      guildId, moderatorId, 'can_mute',
      { discordRoleIds: selfMember.roles.cache.map((r) => r.id), isGuildOwner: guild.ownerId === moderatorId }
    );
    if (!canMute) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.punitive).setDescription('🚫 You lack permission to mute members.')] });
      return;
    }

    try {
      const mute = await container.moderationService.muteUser(guildId, target.id, duration, moderatorId, reason);

      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (targetMember) {
        await targetMember.timeout(duration * 60_000, reason ?? `[Case #${mute.caseNumber}]`).catch(() => null);
      }

      const until = mute.expiresAt instanceof Date
        ? `<t:${Math.floor(mute.expiresAt.getTime() / 1000)}:R>`
        : String(mute.expiresAt);

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.punitive)
        .setTitle('🔇 Member Muted')
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Until', value: until, inline: true },
          { name: 'Case', value: `#${mute.caseNumber}`, inline: true },
          { name: 'Reason', value: reason ?? 'No reason provided' }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
