import type { FamilyMemberDto, FamilyRole } from "@sailorclawbot/contracts";
import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

const ROLE_LABEL: Record<FamilyRole, string> = {
	OWNER: "👑 Owner",
	OFFICER: "⭐ Officer",
	MEMBER: "👤 Member",
};

const ROLE_ORDER: Record<FamilyRole, number> = {
	OWNER: 0,
	OFFICER: 1,
	MEMBER: 2,
};

function renderMembers(members: FamilyMemberDto[]): string {
	return [...members]
		.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
		.map((m) => `${ROLE_LABEL[m.role]} — <@${m.userId}>`)
		.join("\n");
}

export const familyCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("family")
		.setDescription("Family / clan management")
		.addSubcommand((s) =>
			s
				.setName("create")
				.setDescription("Create a new family")
				.addStringOption((o) =>
					o.setName("name").setDescription("Family name").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s.setName("disband").setDescription("Disband your family (owner only)"),
		)
		.addSubcommand((s) =>
			s
				.setName("info")
				.setDescription("Show your family (or another by name)")
				.addStringOption((o) =>
					o.setName("name").setDescription("Family name"),
				),
		)
		.addSubcommand((s) =>
			s.setName("list").setDescription("List all families on this server"),
		)
		.addSubcommand((s) =>
			s
				.setName("invite")
				.setDescription("Add a user to your family (owner/officer)")
				.addUserOption((o) =>
					o.setName("user").setDescription("User to add").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("kick")
				.setDescription("Remove a member from your family (owner/officer)")
				.addUserOption((o) =>
					o.setName("user").setDescription("User to remove").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("promote")
				.setDescription("Promote a member to officer (owner only)")
				.addUserOption((o) =>
					o.setName("user").setDescription("User to promote").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("demote")
				.setDescription("Demote an officer to member (owner only)")
				.addUserOption((o) =>
					o.setName("user").setDescription("User to demote").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("transfer")
				.setDescription("Transfer ownership to another member (owner only)")
				.addUserOption((o) =>
					o.setName("user").setDescription("New owner").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("rename")
				.setDescription("Rename your family (owner/officer)")
				.addStringOption((o) =>
					o.setName("name").setDescription("New name").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s.setName("leave").setDescription("Leave your family"),
		)
		.addSubcommand((s) =>
			s.setName("leaderboard").setDescription("Top families by total XP"),
		)
		.addSubcommand((s) =>
			s
				.setName("join")
				.setDescription("Join a family (or request to, if approval is required)")
				.addStringOption((o) =>
					o.setName("name").setDescription("Family name").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("requests")
				.setDescription("List pending join requests (owner/officer)"),
		)
		.addSubcommand((s) =>
			s
				.setName("accept")
				.setDescription("Accept a pending join request (owner/officer)")
				.addUserOption((o) =>
					o.setName("user").setDescription("User to accept").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("deny")
				.setDescription("Deny a pending join request (owner/officer)")
				.addUserOption((o) =>
					o.setName("user").setDescription("User to deny").setRequired(true),
				),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		const sub = interaction.options.getSubcommand();
		const guildId = interaction.guildId!;
		const actorId = interaction.user.id;
		const svc = container.familyService;

		try {
			switch (sub) {
				case "create": {
					await interaction.deferReply();
					const name = interaction.options.getString("name", true);
					const fam = await svc.createFamily(guildId, name, actorId);
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(EMBED_COLORS.family)
								.setTitle("🏠 Family created")
								.setDescription(`**${fam.name}** founded by <@${actorId}>.`),
						],
					});
					return;
				}

				case "disband": {
					await interaction.deferReply();
					const fam = await svc.disbandFamily(guildId, actorId);
					await interaction.editReply({
						content: `💥 Family **${fam.name}** has been disbanded.`,
						allowedMentions: { parse: [] },
					});
					return;
				}

				case "rename": {
					await interaction.deferReply();
					const name = interaction.options.getString("name", true);
					const fam = await svc.renameFamily(guildId, actorId, name);
					await interaction.editReply({
						content: `✏️ Family renamed to **${fam.name}**.`,
						allowedMentions: { parse: [] },
					});
					return;
				}

				case "invite": {
					await interaction.deferReply();
					const target = interaction.options.getUser("user", true);
					await svc.invite(guildId, actorId, target.id);
					await interaction.editReply(`✅ <@${target.id}> joined the family.`);
					return;
				}

				case "kick": {
					await interaction.deferReply();
					const target = interaction.options.getUser("user", true);
					await svc.kick(guildId, actorId, target.id);
					await interaction.editReply(
						`👢 <@${target.id}> was removed from the family.`,
					);
					return;
				}

				case "promote": {
					await interaction.deferReply();
					const target = interaction.options.getUser("user", true);
					await svc.promote(guildId, actorId, target.id);
					await interaction.editReply(`⭐ <@${target.id}> is now an officer.`);
					return;
				}

				case "demote": {
					await interaction.deferReply();
					const target = interaction.options.getUser("user", true);
					await svc.demote(guildId, actorId, target.id);
					await interaction.editReply(
						`🔻 <@${target.id}> is now a regular member.`,
					);
					return;
				}

				case "transfer": {
					await interaction.deferReply();
					const target = interaction.options.getUser("user", true);
					const fam = await svc.transferOwnership(guildId, actorId, target.id);
					await interaction.editReply(
						`👑 <@${target.id}> is now the owner of **${fam.name}**.`,
					);
					return;
				}

				case "leave": {
					await interaction.deferReply({ ephemeral: true });
					await svc.leave(guildId, actorId);
					await interaction.editReply("🚪 You left your family.");
					return;
				}

				case "info": {
					await interaction.deferReply();
					const name = interaction.options.getString("name");
					const result = name
						? await (async () => {
								const fam = await svc.findFamilyByName(guildId, name);
								return fam ? svc.getFamilyInfo(fam.id) : null;
							})()
						: await svc.getMyFamily(guildId, actorId);

					if (!result) {
						await interaction.editReply(
							name
								? `No family named **${name}** here.`
								: "You are not in a family. Use `/family create`.",
						);
						return;
					}

					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(EMBED_COLORS.family)
								.setTitle(`🏠 ${result.family.name}`)
								.setDescription(renderMembers(result.members))
								.setFooter({ text: `${result.members.length} member(s)` }),
						],
					});
					return;
				}

				case "list": {
					await interaction.deferReply();
					const families = await svc.listFamilies(guildId);
					if (families.length === 0) {
						await interaction.editReply("No families on this server yet.");
						return;
					}
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(EMBED_COLORS.family)
								.setTitle("🏠 Families")
								.setDescription(
									families
										.map((f) => `• **${f.name}** — owner <@${f.ownerUserId}>`)
										.join("\n"),
								),
						],
					});
					return;
				}

				case "join": {
					await interaction.deferReply();
					const name = interaction.options.getString("name", true);
					const result = await svc.requestJoin(guildId, actorId, name);
					await interaction.editReply({
						content:
							result.status === "joined"
								? `✅ <@${actorId}> joined **${name}**.`
								: `📨 Join request sent to **${name}**. An owner or officer must approve it.`,
						allowedMentions: { parse: [] },
					});
					return;
				}

				case "requests": {
					await interaction.deferReply({ ephemeral: true });
					const requests = await svc.listJoinRequests(guildId, actorId);
					if (requests.length === 0) {
						await interaction.editReply("No pending join requests.");
						return;
					}
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(EMBED_COLORS.family)
								.setTitle("📨 Pending join requests")
								.setDescription(
									requests.map((r) => `• <@${r.userId}>`).join("\n"),
								),
						],
						allowedMentions: { parse: [] },
					});
					return;
				}

				case "accept": {
					await interaction.deferReply();
					const target = interaction.options.getUser("user", true);
					await svc.acceptJoin(guildId, actorId, target.id);
					await interaction.editReply(
						`✅ <@${target.id}> was accepted into the family.`,
					);
					return;
				}

				case "deny": {
					await interaction.deferReply({ ephemeral: true });
					const target = interaction.options.getUser("user", true);
					await svc.denyJoin(guildId, actorId, target.id);
					await interaction.editReply({
						content: `🚫 Join request from <@${target.id}> was denied.`,
						allowedMentions: { parse: [] },
					});
					return;
				}

				case "leaderboard": {
					await interaction.deferReply();
					const top = await svc.leaderboard(guildId);
					if (top.length === 0) {
						await interaction.editReply("No families on this server yet.");
						return;
					}
					const medals = ["🥇", "🥈", "🥉"];
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setColor(EMBED_COLORS.family)
								.setTitle("🏆 Family Leaderboard")
								.setDescription(
									top
										.map(
											(e, i) =>
												`${medals[i] ?? `**${i + 1}.**`} **${e.name}** — ${e.totalXp.toLocaleString()} XP · ${e.memberCount} member(s)`,
										)
										.join("\n"),
								),
						],
					});
					return;
				}
			}
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
