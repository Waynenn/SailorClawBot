import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	BanDto,
	BanRepository,
	CaseDto,
	CaseRepository,
	MuteDto,
	MuteRepository,
	PermissionOverrideDto,
	PermissionRepository,
	StaffNoteDto,
	StaffNoteRepository,
	WarningDto,
	WarningRepository,
} from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import type { DomainEvent, EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";
import { ModerationService } from "./ModerationService.js";

class InMemoryStaffNoteRepository implements StaffNoteRepository {
	private readonly notes: StaffNoteDto[] = [];

	async create(
		data: Omit<StaffNoteDto, "id" | "createdAt">,
	): Promise<StaffNoteDto> {
		const note: StaffNoteDto = {
			id: `note_${this.notes.length + 1}`,
			createdAt: new Date(),
			...data,
		};
		this.notes.push(note);
		return note;
	}

	async findByGuildAndUser(
		guildId: string,
		userId: string,
	): Promise<StaffNoteDto[]> {
		return this.notes.filter(
			(n) => n.guildId === guildId && n.userId === userId,
		);
	}
}

interface HarnessOptions {
	warningCount?: number;
	existingMute?: MuteDto | null;
	existingBan?: BanDto | null;
	permission?: PermissionOverrideDto | null;
}

function createHarness(opts: HarnessOptions = {}) {
	const events: DomainEvent[] = [];
	let caseSeq = 0;
	const staffNoteRepo = new InMemoryStaffNoteRepository();
	const warningCreates: WarningDto[] = [];
	const muteCreates: MuteDto[] = [];
	const banCreates: BanDto[] = [];
	const caseCreates: CaseDto[] = [];

	const warnings: WarningRepository = {
		findById: async () => null,
		findByGuildAndUser: async () => [],
		count: async () => (opts.warningCount ?? 0) + warningCreates.length,
		create: async (input) => {
			const dto: WarningDto = {
				id: `warn_${warningCreates.length + 1}`,
				createdAt: new Date(),
				...input,
			};
			warningCreates.push(dto);
			return dto;
		},
	};

	const mutes: MuteRepository = {
		findById: async () => null,
		findByGuildAndUser: async () => opts.existingMute ?? null,
		findActive: async () => [],
		findExpired: async () => [],
		create: async (input) => {
			const dto: MuteDto = {
				id: `mute_${muteCreates.length + 1}`,
				createdAt: new Date(),
				...input,
			};
			muteCreates.push(dto);
			return dto;
		},
		deactivate: async (id) => ({
			id,
			guildId: "g",
			userId: "u",
			moderatorId: "m",
			caseNumber: 1,
			duration: 1,
			expiresAt: new Date(),
			isActive: false,
			createdAt: new Date(),
		}),
		delete: async () => {},
	};

	const bans: BanRepository = {
		findById: async () => null,
		findByGuildAndUser: async () => opts.existingBan ?? null,
		findActive: async () => [],
		findExpired: async () => [],
		create: async (input) => {
			const dto: BanDto = {
				id: `ban_${banCreates.length + 1}`,
				createdAt: new Date(),
				...input,
			};
			banCreates.push(dto);
			return dto;
		},
		deactivate: async (id) => ({
			id,
			guildId: "g",
			userId: "u",
			reason: "x",
			moderatorId: "m",
			caseNumber: 1,
			isActive: false,
			createdAt: new Date(),
		}),
		delete: async () => {},
	};

	const cases: CaseRepository = {
		findById: async () => null,
		findByGuildAndNumber: async () => null,
		listByGuild: async () => [],
		listByUser: async () => [],
		getNextCaseNumber: async () => ++caseSeq,
		create: async (input) => {
			const dto: CaseDto = {
				id: `case_${caseCreates.length + 1}`,
				createdAt: new Date(),
				updatedAt: new Date(),
				...input,
			};
			caseCreates.push(dto);
			return dto;
		},
		update: async () => {
			throw new Error("update not used in these tests");
		},
		delete: async () => {},
	};

	const permissions: PermissionRepository = {
		findByGuildUserPermission: async () => opts.permission ?? null,
		findByGuildUser: async () => [],
		create: async () => {
			throw new Error("create not used in these tests");
		},
		update: async () => {
			throw new Error("update not used in these tests");
		},
		delete: async () => {},
		deleteByGuildAndUser: async () => 0,
	};

	const eventBus: EventBus = {
		publish: async (event) => {
			events.push(event);
		},
	};

	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	const service = new ModerationService(
		warnings,
		mutes,
		bans,
		cases,
		permissions,
		eventBus,
		logger,
		staffNoteRepo,
	);

	return {
		service,
		events,
		warningCreates,
		muteCreates,
		banCreates,
		caseCreates,
		staffNoteRepo,
	};
}

const allowOverride: PermissionOverrideDto = {
	id: "p1",
	guildId: "g1",
	userId: "mod1",
	permission: "can_moderate",
	allowed: true,
};

test("warnUser creates a warning, a case, and emits moderation.warned", async () => {
	const h = createHarness({ permission: allowOverride });
	const warning = await h.service.warnUser("g1", "u1", "spam", "mod1");

	assert.equal(warning.guildId, "g1");
	assert.equal(warning.caseNumber, 1);
	assert.equal(h.warningCreates.length, 1);
	assert.equal(h.caseCreates.length, 1);
	assert.equal(h.caseCreates[0]?.type, "warning");
	assert.ok(h.events.some((e) => e.name === "moderation.warned"));
});

test("warnUser rejects an empty reason", async () => {
	const h = createHarness();
	await assert.rejects(
		() => h.service.warnUser("g1", "u1", "   ", "mod1"),
		ValidationError,
	);
});

test("warnUser rejects warning yourself", async () => {
	const h = createHarness();
	await assert.rejects(
		() => h.service.warnUser("g1", "mod1", "reason", "mod1"),
		ValidationError,
	);
});

test("warnUser auto-mutes after reaching the warning threshold", async () => {
	const h = createHarness({ warningCount: 2, permission: allowOverride });
	await h.service.warnUser("g1", "u1", "spam", "mod1");

	assert.equal(h.muteCreates.length, 1);
	const warned = h.events.find((e) => e.name === "moderation.warned");
	assert.ok(warned);
	assert.equal((warned.payload as { autoMuted: boolean }).autoMuted, true);
	assert.ok(h.events.some((e) => e.name === "moderation.muted"));
});

test("muteUser rejects a user who is already actively muted", async () => {
	const activeMute: MuteDto = {
		id: "m1",
		guildId: "g1",
		userId: "u1",
		moderatorId: "mod1",
		caseNumber: 1,
		duration: 60,
		expiresAt: new Date(Date.now() + 3_600_000),
		isActive: true,
		createdAt: new Date(),
	};
	const h = createHarness({
		existingMute: activeMute,
		permission: allowOverride,
	});
	await assert.rejects(
		() => h.service.muteUser("g1", "u1", 60, "mod1"),
		ConflictError,
	);
});

test("muteUser rejects a non-positive duration", async () => {
	const h = createHarness();
	await assert.rejects(
		() => h.service.muteUser("g1", "u1", 0, "mod1"),
		ValidationError,
	);
});

// BUG-R2 regression: muteUser had no self-targeting guard (unlike warnUser/kickUser)
test("muteUser — BUG-R2: rejects muting yourself", async () => {
	const h = createHarness();
	await assert.rejects(
		() => h.service.muteUser("g1", "mod1", 60, "mod1"),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

test("banUser bans and emits moderation.banned", async () => {
	const h = createHarness({ permission: allowOverride });
	const ban = await h.service.banUser("g1", "u1", "raiding", "mod1");

	assert.equal(ban.isActive, true);
	assert.equal(h.banCreates.length, 1);
	assert.ok(h.events.some((e) => e.name === "moderation.banned"));
});

test("unmuteUser throws when the user is not muted", async () => {
	const h = createHarness({ existingMute: null, permission: allowOverride });
	await assert.rejects(
		() => h.service.unmuteUser("g1", "u1", "mod1"),
		ConflictError,
	);
});

test("muteUser mutes a user and emits moderation.muted", async () => {
	const h = createHarness({ permission: allowOverride });
	const mute = await h.service.muteUser("g1", "u1", 60, "mod1", "flooding");

	assert.equal(mute.isActive, true);
	assert.equal(mute.duration, 60);
	assert.equal(h.muteCreates.length, 1);
	assert.equal(h.caseCreates.length, 1);
	assert.equal(h.caseCreates[0]?.type, "mute");
	assert.ok(h.events.some((e) => e.name === "moderation.muted"));
});

test("muteUser already muted with string expiresAt still throws ConflictError", async () => {
	const activeMute: MuteDto = {
		id: "m1",
		guildId: "g1",
		userId: "u1",
		moderatorId: "mod1",
		caseNumber: 1,
		duration: 60,
		expiresAt: new Date(Date.now() + 3_600_000),
		isActive: true,
		createdAt: new Date(),
	};
	const h = createHarness({
		existingMute: {
			...activeMute,
			expiresAt: "2099-01-01T00:00:00.000Z" as unknown as Date,
		},
		permission: allowOverride,
	});
	await assert.rejects(
		() => h.service.muteUser("g1", "u1", 60, "mod1"),
		ConflictError,
	);
});

test("unmuteUser deactivates an active mute and emits moderation.unmuted", async () => {
	const activeMute: MuteDto = {
		id: "m1",
		guildId: "g1",
		userId: "u1",
		moderatorId: "mod1",
		caseNumber: 1,
		duration: 60,
		expiresAt: new Date(Date.now() + 3_600_000),
		isActive: true,
		createdAt: new Date(),
	};
	const h = createHarness({
		existingMute: activeMute,
		permission: allowOverride,
	});
	await h.service.unmuteUser("g1", "u1", "mod1");

	assert.ok(h.events.some((e) => e.name === "moderation.unmuted"));
});

// BUG-R3 regression: banUser had no self-targeting guard (unlike warnUser/kickUser)
test("banUser — BUG-R3: rejects banning yourself", async () => {
	const h = createHarness();
	await assert.rejects(
		() => h.service.banUser("g1", "mod1", "reason", "mod1"),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

test("banUser throws ConflictError when user is already banned", async () => {
	const activeBan: BanDto = {
		id: "b1",
		guildId: "g1",
		userId: "u1",
		reason: "raiding",
		moderatorId: "mod1",
		caseNumber: 1,
		isActive: true,
		createdAt: new Date(),
	};
	const h = createHarness({
		existingBan: activeBan,
		permission: allowOverride,
	});
	await assert.rejects(
		() => h.service.banUser("g1", "u1", "raiding", "mod1"),
		ConflictError,
	);
});

test("banUser creates a temporary ban with expiresAt when durationDays provided", async () => {
	const h = createHarness({ permission: allowOverride });
	const ban = await h.service.banUser("g1", "u1", "raiding", "mod1", 7);

	assert.ok(ban.expiresAt instanceof Date);
	assert.equal(h.banCreates.length, 1);
	assert.ok(h.events.some((e) => e.name === "moderation.banned"));
	const payload = h.events.find((e) => e.name === "moderation.banned")
		?.payload as { temporary: boolean };
	assert.equal(payload.temporary, true);
});

test("unbanUser deactivates an active ban and emits moderation.unbanned", async () => {
	const activeBan: BanDto = {
		id: "b1",
		guildId: "g1",
		userId: "u1",
		reason: "raiding",
		moderatorId: "mod1",
		caseNumber: 1,
		isActive: true,
		createdAt: new Date(),
	};
	const h = createHarness({
		existingBan: activeBan,
		permission: allowOverride,
	});
	await h.service.unbanUser("g1", "u1", "mod1");

	assert.ok(h.events.some((e) => e.name === "moderation.unbanned"));
});

test("unbanUser throws ConflictError when user is not banned", async () => {
	const h = createHarness({ existingBan: null, permission: allowOverride });
	await assert.rejects(
		() => h.service.unbanUser("g1", "u1", "mod1"),
		ConflictError,
	);
});

test("addNote saves a staff note and returns it", async () => {
	const h = createHarness();
	const note = await h.service.addNote(
		"g1",
		"u1",
		"mod1",
		"Suspicious behaviour",
	);
	assert.equal(note.guildId, "g1");
	assert.equal(note.userId, "u1");
	assert.equal(note.content, "Suspicious behaviour");
});

test("addNote throws ValidationError when content is empty", async () => {
	const h = createHarness();
	await assert.rejects(() => h.service.addNote("g1", "u1", "mod1", "  "), {
		name: "ValidationError",
	});
});

test("getNotes returns notes for a specific user", async () => {
	const h = createHarness();
	await h.service.addNote("g1", "u2", "mod1", "First note");
	await h.service.addNote("g1", "u2", "mod1", "Second note");
	const notes = await h.service.getNotes("g1", "u2");
	assert.ok(notes.length >= 2);
	assert.ok(notes.every((n) => n.userId === "u2"));
});
