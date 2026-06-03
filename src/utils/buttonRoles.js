import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildConfig, setGuildConfig } from './settings.js';

export function getButtonRolesConfig(guildId) {
  const config = getGuildConfig(guildId);
  return config.buttonRoles || {
    channelId: null,
    messageId: null,
    embedTitle: 'Role Menu',
    embedDescription: 'Click a button to toggle a role.',
    embedColor: '#5865f2',
    embedImageUrl: null,
    embedThumbnailUrl: null,
    embedFooter: 'Press a button to add or remove a role.',
    roles: []
  };
}

export function setButtonRolesConfig(guildId, buttonRoles) {
  setGuildConfig(guildId, { buttonRoles });
}

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

export function buildButtonRoleEmbed(guild, config) {
  const embed = new EmbedBuilder()
    .setTitle(config.embedTitle || 'Role Menu')
    .setDescription(config.embedDescription || 'Click a button to add or remove a role.')
    .setColor(parseColor(config.embedColor) ?? 0x5865f2)
    .setFooter({ text: config.embedFooter || 'Press a button to add or remove a role.' })
    .setTimestamp();

  if (config.embedThumbnailUrl) embed.setThumbnail(config.embedThumbnailUrl);
  if (config.embedImageUrl) embed.setImage(config.embedImageUrl);

  if (config.roles && config.roles.length > 0) {
    const fields = config.roles.map((item) => ({
      name: item.label || item.roleName || 'Role',
      value: `Role: <@&${item.roleId}>${item.description ? `\n${item.description}` : ''}`,
      inline: false
    }));
    embed.addFields(fields);
  } else {
    embed.addFields({ name: 'No roles configured', value: 'Add roles with `/buttonroles add`.' });
  }

  return embed;
}

export function buildButtonRows(config) {
  const rows = [];
  const buttons = (config.roles || []).slice(0, 25).map((item) =>
    new ButtonBuilder()
      .setCustomId(`buttonrole_toggle:${item.roleId}`)
      .setLabel(item.label || item.roleName || 'Toggle Role')
      .setStyle(ButtonStyle.Secondary)
  );

  while (buttons.length) {
    const row = new ActionRowBuilder().addComponents(buttons.splice(0, 5));
    rows.push(row);
  }

  return rows;
}

export async function updateButtonRoleMessage(client, guild) {
  const config = getButtonRolesConfig(guild.id);
  if (!config.channelId) return null;

  const channel = await guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;

  const embed = buildButtonRoleEmbed(guild, config);
  const components = buildButtonRows(config);

  let message = null;
  if (config.messageId) {
    message = await channel.messages.fetch(config.messageId).catch(() => null);
  }

  if (message) {
    await message.edit({ embeds: [embed], components }).catch(() => null);
  } else {
    message = await channel.send({ embeds: [embed], components }).catch(() => null);
    if (message) {
      config.messageId = message.id;
      setButtonRolesConfig(guild.id, config);
    }
  }

  return message;
}

export function findButtonRole(config, roleId) {
  if (!config || !config.roles) return null;
  return config.roles.find((item) => item.roleId === roleId);
}
