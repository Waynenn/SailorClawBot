import type { AutoModRuleDto, AutoModResult } from '@sailorclawbot/contracts';

const URL_REGEX = /https?:\/\/([^\s/]+)/gi;
const INVITE_REGEX = /discord(?:\.gg|\.com\/invite)\/([^\s/]+)/i;
const MENTION_REGEX = /<@!?\d+>|@here|@everyone/g;

const spamTracker = new Map<string, { count: number; windowStart: number }>();

export class AutoModService {
  public checkMessage(
    content: string,
    userId: string,
    channelId: string,
    guildId: string,
    rules: AutoModRuleDto[]
  ): AutoModResult | null {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const result = this.checkRule(content, userId, guildId, rule);
      if (result) return result;
    }
    return null;
  }

  private checkRule(
    content: string,
    userId: string,
    guildId: string,
    rule: AutoModRuleDto
  ): AutoModResult | null {
    switch (rule.type) {
      case 'spam':
        return this.checkSpam(userId, guildId, rule.config as { threshold: number; windowMs: number; action: string; duration?: number });
      case 'links':
        return this.checkLinks(content, rule.config as { whitelist: string[]; action: string });
      case 'caps':
        return this.checkCaps(content, rule.config as { threshold: number; action: string });
      case 'invites':
        return this.checkInvites(content, rule.config as { whitelist: string[]; action: string });
      case 'mentions':
        return this.checkMentions(content, rule.config as { max: number; action: string; duration?: number });
      case 'words':
        return this.checkWords(content, rule.config as { patterns: string[]; action: string; duration?: number });
      default:
        return null;
    }
  }

  private checkSpam(
    userId: string,
    guildId: string,
    config: { threshold: number; windowMs: number; action: string; duration?: number }
  ): AutoModResult | null {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const entry = spamTracker.get(key);

    if (!entry || now - entry.windowStart > config.windowMs) {
      spamTracker.set(key, { count: 1, windowStart: now });
      return null;
    }

    entry.count += 1;
    if (entry.count >= config.threshold) {
      spamTracker.delete(key);
      const spamResult: AutoModResult = {
        ruleType: 'spam',
        action: config.action as AutoModResult['action'],
      };
      if (config.duration !== undefined) spamResult.durationMinutes = config.duration;
      return spamResult;
    }
    return null;
  }

  private checkLinks(
    content: string,
    config: { whitelist: string[]; action: string }
  ): AutoModResult | null {
    const matches = [...content.matchAll(URL_REGEX)];
    if (matches.length === 0) return null;

    for (const match of matches) {
      const domain = match[1].toLowerCase();
      const allowed = config.whitelist.some((w) => domain === w || domain.endsWith(`.${w}`));
      if (!allowed) {
        return { ruleType: 'links', action: config.action as AutoModResult['action'] };
      }
    }
    return null;
  }

  private checkCaps(
    content: string,
    config: { threshold: number; action: string }
  ): AutoModResult | null {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 10) return null;

    const upperCount = letters.replace(/[^A-Z]/g, '').length;
    const percent = (upperCount / letters.length) * 100;

    if (percent >= config.threshold) {
      return { ruleType: 'caps', action: config.action as AutoModResult['action'] };
    }
    return null;
  }

  private checkInvites(
    content: string,
    config: { whitelist: string[]; action: string }
  ): AutoModResult | null {
    const match = INVITE_REGEX.exec(content);
    if (!match) return null;

    const code = match[1].toLowerCase();
    if (config.whitelist.some((w) => w.toLowerCase() === code)) return null;

    return { ruleType: 'invites', action: config.action as AutoModResult['action'] };
  }

  private checkMentions(
    content: string,
    config: { max: number; action: string; duration?: number }
  ): AutoModResult | null {
    const mentions = content.match(MENTION_REGEX) ?? [];
    if (mentions.length > config.max) {
      const mentionResult: AutoModResult = {
        ruleType: 'mentions',
        action: config.action as AutoModResult['action'],
      };
      if (config.duration !== undefined) mentionResult.durationMinutes = config.duration;
      return mentionResult;
    }
    return null;
  }

  private checkWords(
    content: string,
    config: { patterns: string[]; action: string; duration?: number }
  ): AutoModResult | null {
    for (const pattern of config.patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(content)) {
        const wordResult: AutoModResult = {
          ruleType: 'words',
          action: config.action as AutoModResult['action'],
        };
        if (config.duration !== undefined) wordResult.durationMinutes = config.duration;
        return wordResult;
      }
    }
    return null;
  }
}
