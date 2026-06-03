import { EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildConfig, setGuildConfig } from './settings.js';

export function normalizeEmoji(value) {
  if (!value) return null;
  const match = value.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  return match ? match[2] : value;
}

export function getReactionRolesConfig(guildId) {
  const config = getGuildConfig(guildId);
  return config.reactionRoles || { channelId: null, messageId: null, roles: [] };
}

export function setReactionRolesConfig(guildId, reactionRoles) {
  setGuildConfig(guildId, { reactionRoles });
}

export function buildReactionRoleEmbed(guild, reactionRoles) {
  const embed = new EmbedBuilder()
    .setTitle('Reaction Role Menu')
    .setDescription('React to this message to add or remove roles.')
    .setColor(0x5865f2)
    .setFooter({ text: 'Self-assign roles using reactions' })
    .setTimestamp();

  if (!reactionRoles.roles || reactionRoles.roles.length === 0) {
    embed.addFields({ name: 'No roles configured', value: 'Use `/reactionroles add` to add reaction roles.' });
    return embed;
  }

  const fields = reactionRoles.roles.map((item) => ({
    name: `${item.emojiRaw || item.emoji} ${item.label || '<role>'}`,
    value: `<@&${item.roleId}>${item.description ? `\n${item.description}` : ''}`,
    inline: false
  }));

  embed.addFields(fields);
  return embed;
}

export async function updateReactionRoleMessage(client, guild) {
  const reactionRoles = getReactionRolesConfig(guild.id);
  if (!reactionRoles.channelId) return null;

  const channel = await guild.channels.fetch(reactionRoles.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;

  const embed = buildReactionRoleEmbed(guild, reactionRoles);
  let message = null;

  if (reactionRoles.messageId) {
    message = await channel.messages.fetch(reactionRoles.messageId).catch(() => null);
  }

  if (message) {
    await message.edit({ embeds: [embed] });
  } else {
    message = await channel.send({ embeds: [embed] });
    reactionRoles.messageId = message.id;
    setReactionRolesConfig(guild.id, reactionRoles);
  }

  for (const item of reactionRoles.roles) {
    const emoji = item.emojiRaw || item.emoji;
    await message.react(emoji).catch(() => null);
  }

  return message;
}

export function findReactionRole(reactionRoles, reaction) {
  if (!reactionRoles || !reactionRoles.roles) return null;
  const emojiId = reaction.emoji.id || reaction.emoji.name;
  return reactionRoles.roles.find((item) => item.emoji === emojiId);
}
