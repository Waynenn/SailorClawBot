import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../index.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const xpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Управление XP (администратор)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('give')
        .setDescription('Выдать XP пользователю')
        .addUserOption((o) => o.setName('user').setDescription('Пользователь').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('Количество XP').setMinValue(1).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Установить общий XP пользователя')
        .addUserOption((o) => o.setName('user').setDescription('Пользователь').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('Итоговый XP').setMinValue(0).setRequired(true))
    ),

  async execute(interaction, container) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const guildId = interaction.guildId!;

    await container.profileService.ensureProfile(guildId, target.id);

    if (sub === 'give') {
      const { profile } = await container.xpService.grantXp(guildId, target.id, amount);
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.xp)
        .setDescription(`✅ Выдано **${amount} XP** для <@${target.id}>. Уровень: **${profile.level}**, Всего XP: **${profile.totalXp}**`);
      await interaction.editReply({ embeds: [embed] });
    } else {
      const profile = await container.xpService.setXp(guildId, target.id, amount);
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.xp)
        .setDescription(`✅ XP для <@${target.id}> установлен на **${amount}**. Уровень: **${profile.level}**`);
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
