import { getGuildConfig, setGuildConfig } from './settings.js';
import { EmbedBuilder } from 'discord.js';

export function getModerationConfig(guildId) {
  const config = getGuildConfig(guildId);
  return config.automod || {
    enabled: true,
    blockLinks: false,
    blockedWords: [],
    blockedLinks: [],
    logChannelId: null
  };
}

export function setModerationConfig(guildId, automodConfig) {
  setGuildConfig(guildId, { automod: automodConfig });
}

export function containsBlockedWord(content, blockedWords) {
  if (!blockedWords || blockedWords.length === 0) return null;
  const lower = content.toLowerCase();
  for (const word of blockedWords) {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(content)) {
      return trimmed;
    }
  }
  return null;
}

export function containsLink(content) {
  const urlRegex = /(?:https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+(?:[\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?/gi;
  return urlRegex.test(content);
}

export function containsBlockedLinkPattern(content, blockedLinks) {
  if (!blockedLinks || blockedLinks.length === 0) return null;
  const lower = content.toLowerCase();
  for (const pattern of blockedLinks) {
    const trimmed = pattern.trim().toLowerCase();
    if (!trimmed) continue;
    if (lower.includes(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

export function buildModerationLogEmbed(message, reason, match) {
  return new EmbedBuilder()
    .setTitle('AutoMod Action')
    .setDescription(`A message was removed for ${reason}.`)
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Reason', value: match, inline: false },
      { name: 'Content', value: message.content?.slice(0, 1024) || '[empty]', inline: false }
    )
    .setTimestamp();
}
