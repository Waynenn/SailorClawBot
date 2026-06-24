import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AutoModService } from './AutoModService.js';

describe('AutoModService', () => {
  const svc = new AutoModService();

  describe('caps rule', () => {
    it('returns null when caps % is below threshold', () => {
      const result = svc.checkMessage('hello world', 'u1', 'c1', 'g1', [
        { id: '1', guildId: 'g1', type: 'caps', enabled: true, config: { threshold: 70, action: 'delete' } },
      ]);
      assert.equal(result, null);
    });

    it('triggers when caps % exceeds threshold', () => {
      const result = svc.checkMessage('HELLO WORLD!!!', 'u1', 'c1', 'g1', [
        { id: '1', guildId: 'g1', type: 'caps', enabled: true, config: { threshold: 70, action: 'delete' } },
      ]);
      assert.deepEqual(result, { ruleType: 'caps', action: 'delete' });
    });

    it('skips short messages (<=10 letter chars)', () => {
      const result = svc.checkMessage('HI!!', 'u1', 'c1', 'g1', [
        { id: '1', guildId: 'g1', type: 'caps', enabled: true, config: { threshold: 50, action: 'delete' } },
      ]);
      assert.equal(result, null);
    });
  });

  describe('invites rule', () => {
    it('triggers on discord invite link', () => {
      const result = svc.checkMessage('Join my server discord.gg/abcdef', 'u1', 'c1', 'g1', [
        { id: '2', guildId: 'g1', type: 'invites', enabled: true, config: { whitelist: [], action: 'delete' } },
      ]);
      assert.deepEqual(result, { ruleType: 'invites', action: 'delete' });
    });

    it('skips whitelisted invite code', () => {
      const result = svc.checkMessage('Join discord.gg/official', 'u1', 'c1', 'g1', [
        { id: '2', guildId: 'g1', type: 'invites', enabled: true, config: { whitelist: ['official'], action: 'delete' } },
      ]);
      assert.equal(result, null);
    });
  });

  describe('mentions rule', () => {
    it('triggers when mentions exceed max', () => {
      const result = svc.checkMessage('<@111> <@222> <@333>', 'u1', 'c1', 'g1', [
        { id: '3', guildId: 'g1', type: 'mentions', enabled: true, config: { max: 2, action: 'mute', duration: 5 } },
      ]);
      assert.deepEqual(result, { ruleType: 'mentions', action: 'mute', durationMinutes: 5 });
    });

    it('returns null when mentions are within limit', () => {
      const result = svc.checkMessage('<@111> <@222>', 'u1', 'c1', 'g1', [
        { id: '3', guildId: 'g1', type: 'mentions', enabled: true, config: { max: 2, action: 'mute', duration: 5 } },
      ]);
      assert.equal(result, null);
    });
  });

  describe('words rule', () => {
    it('triggers on banned word', () => {
      const result = svc.checkMessage('you are a badword', 'u1', 'c1', 'g1', [
        { id: '4', guildId: 'g1', type: 'words', enabled: true, config: { patterns: ['badword'], action: 'warn' } },
      ]);
      assert.deepEqual(result, { ruleType: 'words', action: 'warn' });
    });

    it('is case-insensitive', () => {
      const result = svc.checkMessage('BADWORD here', 'u1', 'c1', 'g1', [
        { id: '4', guildId: 'g1', type: 'words', enabled: true, config: { patterns: ['badword'], action: 'warn' } },
      ]);
      assert.deepEqual(result, { ruleType: 'words', action: 'warn' });
    });
  });

  describe('links rule', () => {
    it('triggers on non-whitelisted URL', () => {
      const result = svc.checkMessage('Check https://malicious.com', 'u1', 'c1', 'g1', [
        { id: '5', guildId: 'g1', type: 'links', enabled: true, config: { whitelist: ['youtube.com'], action: 'delete' } },
      ]);
      assert.deepEqual(result, { ruleType: 'links', action: 'delete' });
    });

    it('skips whitelisted domain', () => {
      const result = svc.checkMessage('Watch https://youtube.com/video', 'u1', 'c1', 'g1', [
        { id: '5', guildId: 'g1', type: 'links', enabled: true, config: { whitelist: ['youtube.com'], action: 'delete' } },
      ]);
      assert.equal(result, null);
    });
  });

  describe('disabled rule', () => {
    it('skips disabled rules', () => {
      const result = svc.checkMessage('HELLO WORLD!!!', 'u1', 'c1', 'g1', [
        { id: '6', guildId: 'g1', type: 'caps', enabled: false, config: { threshold: 50, action: 'delete' } },
      ]);
      assert.equal(result, null);
    });
  });
});
