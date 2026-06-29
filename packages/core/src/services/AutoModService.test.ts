import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AutoModService } from "./AutoModService.js";

describe("AutoModService", () => {
	const svc = new AutoModService();

	describe("caps rule", () => {
		it("returns null when caps % is below threshold", () => {
			const result = svc.checkMessage("hello world", "u1", "c1", "g1", [
				{
					id: "1",
					guildId: "g1",
					type: "caps",
					enabled: true,
					config: { threshold: 70, action: "delete" },
				},
			]);
			assert.equal(result, null);
		});

		it("triggers when caps % exceeds threshold", () => {
			const result = svc.checkMessage("HELLO WORLD!!!", "u1", "c1", "g1", [
				{
					id: "1",
					guildId: "g1",
					type: "caps",
					enabled: true,
					config: { threshold: 70, action: "delete" },
				},
			]);
			assert.deepEqual(result, { ruleType: "caps", action: "delete" });
		});

		it("skips short messages (<=10 letter chars)", () => {
			const result = svc.checkMessage("HI!!", "u1", "c1", "g1", [
				{
					id: "1",
					guildId: "g1",
					type: "caps",
					enabled: true,
					config: { threshold: 50, action: "delete" },
				},
			]);
			assert.equal(result, null);
		});
	});

	describe("invites rule", () => {
		it("triggers on discord invite link", () => {
			const result = svc.checkMessage(
				"Join my server discord.gg/abcdef",
				"u1",
				"c1",
				"g1",
				[
					{
						id: "2",
						guildId: "g1",
						type: "invites",
						enabled: true,
						config: { whitelist: [], action: "delete" },
					},
				],
			);
			assert.deepEqual(result, { ruleType: "invites", action: "delete" });
		});

		it("skips whitelisted invite code", () => {
			const result = svc.checkMessage(
				"Join discord.gg/official",
				"u1",
				"c1",
				"g1",
				[
					{
						id: "2",
						guildId: "g1",
						type: "invites",
						enabled: true,
						config: { whitelist: ["official"], action: "delete" },
					},
				],
			);
			assert.equal(result, null);
		});
	});

	describe("mentions rule", () => {
		it("triggers when mentions exceed max", () => {
			const result = svc.checkMessage(
				"<@111> <@222> <@333>",
				"u1",
				"c1",
				"g1",
				[
					{
						id: "3",
						guildId: "g1",
						type: "mentions",
						enabled: true,
						config: { max: 2, action: "mute", duration: 5 },
					},
				],
			);
			assert.deepEqual(result, {
				ruleType: "mentions",
				action: "mute",
				durationMinutes: 5,
			});
		});

		it("returns null when mentions are within limit", () => {
			const result = svc.checkMessage("<@111> <@222>", "u1", "c1", "g1", [
				{
					id: "3",
					guildId: "g1",
					type: "mentions",
					enabled: true,
					config: { max: 2, action: "mute", duration: 5 },
				},
			]);
			assert.equal(result, null);
		});
	});

	describe("words rule", () => {
		it("triggers on banned word", () => {
			const result = svc.checkMessage("you are a badword", "u1", "c1", "g1", [
				{
					id: "4",
					guildId: "g1",
					type: "words",
					enabled: true,
					config: { patterns: ["badword"], action: "warn" },
				},
			]);
			assert.deepEqual(result, { ruleType: "words", action: "warn" });
		});

		it("is case-insensitive", () => {
			const result = svc.checkMessage("BADWORD here", "u1", "c1", "g1", [
				{
					id: "4",
					guildId: "g1",
					type: "words",
					enabled: true,
					config: { patterns: ["badword"], action: "warn" },
				},
			]);
			assert.deepEqual(result, { ruleType: "words", action: "warn" });
		});
	});

	describe("links rule", () => {
		it("triggers on non-whitelisted URL", () => {
			const result = svc.checkMessage(
				"Check https://malicious.com",
				"u1",
				"c1",
				"g1",
				[
					{
						id: "5",
						guildId: "g1",
						type: "links",
						enabled: true,
						config: { whitelist: ["youtube.com"], action: "delete" },
					},
				],
			);
			assert.deepEqual(result, { ruleType: "links", action: "delete" });
		});

		it("skips whitelisted domain", () => {
			const result = svc.checkMessage(
				"Watch https://youtube.com/video",
				"u1",
				"c1",
				"g1",
				[
					{
						id: "5",
						guildId: "g1",
						type: "links",
						enabled: true,
						config: { whitelist: ["youtube.com"], action: "delete" },
					},
				],
			);
			assert.equal(result, null);
		});
	});

	describe("disabled rule", () => {
		it("skips disabled rules", () => {
			const result = svc.checkMessage("HELLO WORLD!!!", "u1", "c1", "g1", [
				{
					id: "6",
					guildId: "g1",
					type: "caps",
					enabled: false,
					config: { threshold: 50, action: "delete" },
				},
			]);
			assert.equal(result, null);
		});
	});

	// BUG-R7: spam rule was entirely untested — spamTracker is module-level state,
	// each test must use unique guildId+userId to avoid cross-test pollution
	describe("spam rule", () => {
		it("returns null on first message (below threshold)", () => {
			const result = svc.checkMessage("hello", "spam_u1", "c1", "spam_g1", [
				{
					id: "7",
					guildId: "spam_g1",
					type: "spam",
					enabled: true,
					config: {
						threshold: 3,
						windowMs: 60_000,
						action: "mute",
						duration: 5,
					},
				},
			]);
			assert.equal(result, null);
		});

		it("returns null on second message (below threshold)", () => {
			const spamRule = {
				threshold: 3,
				windowMs: 60_000,
				action: "mute" as const,
				duration: 5,
			};
			svc.checkMessage("msg1", "spam_u2", "c1", "spam_g2", [
				{
					id: "8",
					guildId: "spam_g2",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			const result = svc.checkMessage("msg2", "spam_u2", "c1", "spam_g2", [
				{
					id: "8",
					guildId: "spam_g2",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			assert.equal(result, null);
		});

		it("triggers on third message (count reaches threshold)", () => {
			const spamRule = {
				threshold: 3,
				windowMs: 60_000,
				action: "mute" as const,
				duration: 5,
			};
			svc.checkMessage("msg1", "spam_u3", "c1", "spam_g3", [
				{
					id: "9",
					guildId: "spam_g3",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			svc.checkMessage("msg2", "spam_u3", "c1", "spam_g3", [
				{
					id: "9",
					guildId: "spam_g3",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			const result = svc.checkMessage("msg3", "spam_u3", "c1", "spam_g3", [
				{
					id: "9",
					guildId: "spam_g3",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			assert.deepEqual(result, {
				ruleType: "spam",
				action: "mute",
				durationMinutes: 5,
			});
		});

		it("resets window after triggering — next message starts fresh", () => {
			const spamRule = {
				threshold: 3,
				windowMs: 60_000,
				action: "mute" as const,
				duration: 5,
			};
			svc.checkMessage("m1", "spam_u4", "c1", "spam_g4", [
				{
					id: "10",
					guildId: "spam_g4",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			svc.checkMessage("m2", "spam_u4", "c1", "spam_g4", [
				{
					id: "10",
					guildId: "spam_g4",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			svc.checkMessage("m3", "spam_u4", "c1", "spam_g4", [
				{
					id: "10",
					guildId: "spam_g4",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]); // triggers, clears entry
			const result = svc.checkMessage("m4", "spam_u4", "c1", "spam_g4", [
				{
					id: "10",
					guildId: "spam_g4",
					type: "spam",
					enabled: true,
					config: spamRule,
				},
			]);
			assert.equal(result, null);
		});
	});

	// BUG-R8: @here and @everyone must count as individual mention matches
	describe("mentions rule — special mention tokens", () => {
		it("@here counts as one mention", () => {
			const result = svc.checkMessage("@here", "u1", "c1", "g1", [
				{
					id: "11",
					guildId: "g1",
					type: "mentions",
					enabled: true,
					config: { max: 0, action: "delete" },
				},
			]);
			assert.deepEqual(result, { ruleType: "mentions", action: "delete" });
		});

		it("@everyone counts as one mention", () => {
			const result = svc.checkMessage("@everyone", "u1", "c1", "g1", [
				{
					id: "12",
					guildId: "g1",
					type: "mentions",
					enabled: true,
					config: { max: 0, action: "delete" },
				},
			]);
			assert.deepEqual(result, { ruleType: "mentions", action: "delete" });
		});

		it("@here and @everyone together count as 2 mentions", () => {
			const result = svc.checkMessage("@here @everyone", "u1", "c1", "g1", [
				{
					id: "13",
					guildId: "g1",
					type: "mentions",
					enabled: true,
					config: { max: 1, action: "mute", duration: 5 },
				},
			]);
			assert.deepEqual(result, {
				ruleType: "mentions",
				action: "mute",
				durationMinutes: 5,
			});
		});
	});

	// BUG-R9: invalid regex in words rule must be silently skipped, not crash
	describe("words rule — invalid regex handling", () => {
		it("skips invalid regex pattern and continues to next pattern", () => {
			const result = svc.checkMessage("badword here", "u1", "c1", "g1", [
				{
					id: "14",
					guildId: "g1",
					type: "words",
					enabled: true,
					config: { patterns: ["[invalid(", "badword"], action: "warn" },
				},
			]);
			assert.deepEqual(result, { ruleType: "words", action: "warn" });
		});

		it("returns null when all patterns are invalid regex", () => {
			const result = svc.checkMessage("anything", "u1", "c1", "g1", [
				{
					id: "15",
					guildId: "g1",
					type: "words",
					enabled: true,
					config: { patterns: ["[invalid(", "(?P<bad>"], action: "warn" },
				},
			]);
			assert.equal(result, null);
		});
	});
});
