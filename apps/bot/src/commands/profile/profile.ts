import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const profileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile or another member\'s')
    .addUserOption((o) => o.setName('user').setDescription('Member to view (defaults to you)')),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const target = interaction.options.getUser('user') ?? interaction.user;
    const guildId = interaction.guildId!;
    const member = interaction.guild?.members.cache.get(target.id);

    try {
      const profile = await container.profileService.ensureProfile(guildId, target.id);

      const embed = new EmbedBuilder()
        .setTitle(profile.displayName ?? target.username)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'User', value: target.tag, inline: true },
          { name: 'Member since', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : 'Unknown', inline: true },
          { name: 'Profile created', value: `<t:${Math.floor(profile.createdAt.getTime() / 1000)}:D>`, inline: true },
        )
        .setColor(0x5865f2)
        .setFooter({ text: `ID: ${target.id}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
