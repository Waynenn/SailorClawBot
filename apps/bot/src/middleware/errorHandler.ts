import type { ChatInputCommandInteraction } from 'discord.js';
import {
  ValidationError,
  NotFoundError,
  PermissionDeniedError,
  ConflictError,
} from '@sailorclawbot/core';

export async function handleCommandError(
  error: unknown,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  let message: string;

  if (error instanceof ValidationError) {
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
    await interaction.editReply(message);
  } else {
    await interaction.reply({ content: message, ephemeral: true });
  }
}
