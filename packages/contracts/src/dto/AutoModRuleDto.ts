export type AutoModAction = "delete" | "warn" | "mute" | "kick" | "ban";

export interface SpamConfig {
	threshold: number;
	windowMs: number;
	action: AutoModAction;
	duration?: number;
}

export interface LinksConfig {
	whitelist: string[];
	action: AutoModAction;
}

export interface CapsConfig {
	threshold: number;
	action: AutoModAction;
}

export interface InvitesConfig {
	whitelist: string[];
	action: AutoModAction;
}

export interface MentionsConfig {
	max: number;
	action: AutoModAction;
	duration?: number;
}

export interface WordsConfig {
	patterns: string[];
	action: AutoModAction;
	duration?: number;
}

export type AutoModConfig =
	| SpamConfig
	| LinksConfig
	| CapsConfig
	| InvitesConfig
	| MentionsConfig
	| WordsConfig;

export type AutoModRuleType =
	| "spam"
	| "links"
	| "caps"
	| "invites"
	| "mentions"
	| "words";

export interface AutoModRuleDto {
	id: string;
	guildId: string;
	type: AutoModRuleType;
	enabled: boolean;
	config: AutoModConfig;
}

export interface AutoModResult {
	ruleType: AutoModRuleType;
	action: AutoModAction;
	durationMinutes?: number;
}
