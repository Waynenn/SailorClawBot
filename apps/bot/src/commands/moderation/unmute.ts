import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const unmuteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a mute from a member')
    .addUserOption((o) => o.setName('user').setDescription('Member to unmute').setRequired(true))
    .setDefaultMemberPermissions(0n),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const moderatorId = interaction.user.id;
    const selfMember = interaction.member as GuildMember;

    const canMute = await container.permissionService.hasPermission(
      guildId, moderatorId, 'can_mute',
      { discordRoleIds: selfMember.roles.cache.map((r) => r.id), isGuildOwner: guild.ownerId === moderatorId }
    );
    if (!canMute) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.punitive).setDescription('🚫 You lack permission to unmute members.')] });
      return;
    }

    try {
      await container.moderationService.unmuteUser(guildId, target.id, moderatorId);

      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (targetMember) {
        await targetMember.timeout(null).catch(() => null);
      }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.restorative)
        .setTitle('🔊 Member Unmuted')
        .addFields({ name: 'User', value: `${target.tag} (${target.id})` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
