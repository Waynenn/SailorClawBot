import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

const RULE_TYPES = ['spam', 'links', 'caps', 'invites', 'mentions', 'words'] as const;

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  spam:     { threshold: 5, windowMs: 5000, action: 'mute', duration: 5 },
  links:    { whitelist: [], action: 'delete' },
  caps:     { threshold: 70, action: 'delete' },
  invites:  { whitelist: [], action: 'delete' },
  mentions: { max: 5, action: 'mute', duration: 10 },
  words:    { patterns: [], action: 'warn' },
};

export const automodCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage AutoMod rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show current AutoMod rules status')
    )
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable an AutoMod rule with default config')
        .addStringOption((o) =>
          o.setName('rule').setDescription('Rule type').setRequired(true)
            .addChoices(...RULE_TYPES.map((t) => ({ name: t, value: t })))
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable an AutoMod rule')
        .addStringOption((o) =>
          o.setName('rule').setDescription('Rule type').setRequired(true)
            .addChoices(...RULE_TYPES.map((t) => ({ name: t, value: t })))
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('verify')
        .setDescription('Set up member verification gate')
        .addRoleOption((o) => o.setName('role').setDescription('Role assigned after verification').setRequired(true))
        .addBooleanOption((o) => o.setName('enabled').setDescription('Enable verification').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('min-age').setDescription('Minimum account age in days (0 = off)').setMinValue(0)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    if (!interaction.guildId) return;
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const rules = await container.autoModRepo.findAllByGuild(guildId);
      const lines = RULE_TYPES.map((type) => {
        const rule = rules.find((r) => r.type === type);
        const icon = rule?.enabled ? '✅' : '❌';
        return `${icon} **${type}**`;
      });
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.info)
        .setTitle('🤖 AutoMod Status')
        .setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'enable') {
      const type = interaction.options.getString('rule', true);
      await container.autoModRepo.upsert(guildId, type, true, DEFAULT_CONFIGS[type] ?? {});
      await interaction.reply({ content: `✅ Rule **${type}** enabled with default config.`, ephemeral: true });
      return;
    }

    if (sub === 'disable') {
      const type = interaction.options.getString('rule', true);
      const rules = await container.autoModRepo.findAllByGuild(guildId);
      const existing = rules.find((r) => r.type === type);
      if (!existing) {
        await interaction.reply({ content: `⚠️ Rule **${type}** is not configured yet.`, ephemeral: true });
        return;
      }
      await container.autoModRepo.upsert(guildId, type, false, existing.config as unknown as Record<string, unknown>);
      await interaction.reply({ content: `✅ Rule **${type}** disabled.`, ephemeral: true });
      return;
    }

    if (sub === 'verify') {
      const role = interaction.options.getRole('role', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      const minAge = interaction.options.getInteger('min-age') ?? 0;

      await container.guildSettingsRepo.upsert(guildId, {
        verificationEnabled: enabled,
        verificationRoleId: role.id,
        verificationMode: 'button',
        minAccountAgeDays: minAge,
      });

      if (enabled) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_${guildId}`)
            .setLabel('✅ Verify')
            .setStyle(ButtonStyle.Success)
        );
        const embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.info)
          .setTitle('🔐 Verification Required')
          .setDescription(`Click the button below to get the <@&${role.id}> role and access the server.`);
        await interaction.reply({ embeds: [embed], components: [row] });
      } else {
        await interaction.reply({ content: '✅ Verification disabled.', ephemeral: true });
      }
    }
  },
};
