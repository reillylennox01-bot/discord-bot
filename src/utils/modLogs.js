import { getGuildConfig, setGuildConfig } from './settings.js';

export function getModerationHistory(guildId, userId) {
  const config = getGuildConfig(guildId);
  const history = config.moderation?.history || [];
  return history.filter((entry) => entry.targetId === userId);
}

export function addModerationLog(guildId, logEntry) {
  const config = getGuildConfig(guildId);
  const moderation = config.moderation || {};
  const currentHistory = Array.isArray(moderation.history) ? moderation.history : [];
  const history = [...currentHistory, logEntry].slice(-100);
  setGuildConfig(guildId, {
    moderation: {
      ...moderation,
      history
    }
  });
  return history;
}
