import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const unbanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Remove a ban from a user')
    .addUserOption((o) => o.setName('user').setDescription('User to unban').setRequired(true))
    .setDefaultMemberPermissions(0n),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const moderatorId = interaction.user.id;
    const selfMember = interaction.member as GuildMember;

    const canBan = await container.permissionService.hasPermission(
      guildId, moderatorId, 'can_ban',
      { discordRoleIds: selfMember.roles.cache.map((r) => r.id), isGuildOwner: guild.ownerId === moderatorId }
    );
    if (!canBan) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.punitive).setDescription('🚫 You lack permission to unban members.')] });
      return;
    }

    try {
      await container.moderationService.unbanUser(guildId, target.id, moderatorId);

      await guild.members.unban(target.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.restorative)
        .setTitle('✅ Member Unbanned')
        .addFields({ name: 'User', value: `${target.tag} (${target.id})` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
