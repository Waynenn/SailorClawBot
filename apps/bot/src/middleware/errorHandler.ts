import type { ChatInputCommandInteraction } from 'discord.js';
import {
  ValidationError,
  NotFoundError,
  PermissionDeniedError,
  ConflictError,
  CooldownError,
} from '@sailorclawbot/core';

function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export async function handleCommandError(
  error: unknown,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  let message: string;

  if (error instanceof CooldownError) {
    message = `⏳ **Cooldown**: Please wait **${formatCooldown(error.remainingMs)}** before using this again.`;
  } else if (error instanceof ValidationError) {
    message = `❌ **Invalid input**: ${error.message}`;
  } else if (error instanceof PermissionDeniedError) {
    message = `🚫 **Permission denied**: ${error.message}`;
  } else if (error instanceof NotFoundError) {
    message = `🔍 **Not found**: ${error.message}`;
  } else if (error instanceof ConflictError) {
    message = `⚠️ **Conflict**: ${error.message}`;
  } else {
    message = '💥 An unexpected error occurred. Please try again later.';
    console.error('[Command Error]', error);
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(message).catch(() => null);
  } else {
    await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
  }
}
