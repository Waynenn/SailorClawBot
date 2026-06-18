import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(0n),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const moderatorId = interaction.user.id;
    const selfMember = interaction.member as GuildMember;

    const canWarn = await container.permissionService.hasPermission(
      guildId, moderatorId, 'can_warn',
      { discordRoleIds: selfMember.roles.cache.map((r) => r.id), isGuildOwner: guild.ownerId === moderatorId }
    );
    if (!canWarn) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.punitive).setDescription('🚫 You lack permission to warn members.')] });
      return;
    }

    try {
      const warning = await container.moderationService.warnUser(guildId, target.id, reason, moderatorId);

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.punitive)
        .setTitle('⚠️ Member Warned')
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Case', value: `#${warning.caseNumber}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
