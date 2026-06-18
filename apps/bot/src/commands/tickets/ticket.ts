import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  CategoryChannel,
} from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { buildStatsEmbed, updateStatsEmbed } from '../../lib/ticketHelper.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management')
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Set up the ticket system in this channel')
        .addChannelOption((o) =>
          o.setName('category').setDescription('Category where ticket channels will be created').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('close').setDescription('Close the ticket in this channel').addStringOption((o) =>
        o.setName('reason').setDescription('Reason for closing')
      )
    )
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add a user to this ticket channel')
        .addUserOption((o) => o.setName('user').setDescription('User to add').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a user from this ticket channel')
        .addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    try {
      if (sub === 'setup') {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply('You need **Manage Guild** permission to set up tickets.');
          return;
        }

        const categoryOption = interaction.options.getChannel('category', true);
        if (!(categoryOption instanceof CategoryChannel)) {
          await interaction.editReply('Please select a **category channel** for tickets.');
          return;
        }

        const stats = await container.ticketService.getStats(guildId);
        const statsEmbed = buildStatsEmbed(stats);
        const statsMsg = await (interaction.channel as TextChannel).send({ embeds: [statsEmbed] });

        await container.guildSettingsRepo.upsert(guildId, {
          ticketChannelId: interaction.channelId,
          ticketCategoryId: categoryOption.id,
          ticketStatsMessageId: statsMsg.id,
        });

        await interaction.editReply(`✅ Ticket system set up in <#${interaction.channelId}>. Category: **${categoryOption.name}**.`);
        return;
      }

      if (sub === 'close') {
        await interaction.deferReply();
        const ticket = await container.ticketService.findByChannel(interaction.channelId);
        if (!ticket) {
          await interaction.editReply('This channel is not a ticket channel.');
          return;
        }

        const reason = interaction.options.getString('reason');
        await container.ticketService.closeTicketByUser(ticket.id, interaction.user.id);
        await interaction.editReply(`🔒 Ticket closed${reason ? ` — ${reason}` : ''}.`);

        if (guild) await updateStatsEmbed(guild, container);

        setTimeout(async () => {
          await (interaction.channel as TextChannel).delete().catch(() => null);
        }, 5000);
        return;
      }

      if (sub === 'add') {
        await interaction.deferReply({ ephemeral: true });
        const ticket = await container.ticketService.findByChannel(interaction.channelId);
        if (!ticket) {
          await interaction.editReply('This channel is not a ticket channel.');
          return;
        }

        const target = interaction.options.getUser('user', true);
        await (interaction.channel as TextChannel).permissionOverwrites.create(target.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        await interaction.editReply(`✅ Added <@${target.id}> to the ticket.`);
        return;
      }

      if (sub === 'remove') {
        await interaction.deferReply({ ephemeral: true });
        const ticket = await container.ticketService.findByChannel(interaction.channelId);
        if (!ticket) {
          await interaction.editReply('This channel is not a ticket channel.');
          return;
        }

        const target = interaction.options.getUser('user', true);
        if (target.id === ticket.openedByUserId) {
          await interaction.editReply('Cannot remove the ticket owner.');
          return;
        }
        await (interaction.channel as TextChannel).permissionOverwrites.delete(target.id);
        await interaction.editReply(`✅ Removed <@${target.id}> from the ticket.`);
        return;
      }
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
