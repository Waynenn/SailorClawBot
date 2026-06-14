import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const kickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for kick').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const moderatorId = interaction.user.id;
    const selfMember = interaction.member as GuildMember;

    const canKick = await container.permissionService.hasPermission(
      guildId, moderatorId, 'can_kick',
      { discordRoleIds: selfMember.roles.cache.map((r) => r.id), isGuildOwner: guild.ownerId === moderatorId }
    );
    if (!canKick) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.punitive).setDescription('🚫 You lack permission to kick members.')] });
      return;
    }

    try {
      const result = await container.moderationService.kickUser(guildId, target.id, reason, moderatorId);

      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (targetMember) {
        await targetMember.kick(`[Case #${result.caseNumber}] ${reason}`).catch(() => null);
      }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.punitive)
        .setTitle('👢 Member Kicked')
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Case', value: `#${result.caseNumber}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
