import { EmbedBuilder } from 'discord.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

export function buildWelcomeEmbed(guild, user, config) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(config.color) ?? 0x00ff00)
    .setTitle(config.title || `Welcome to ${guild.name}!`)
    .setDescription(
      config.description || `Hello ${user}, welcome to **${guild.name}**! We're happy to have you here.`
    )
    .setThumbnail(config.thumbnailUrl || user.displayAvatarURL({ extension: 'png', size: 512 }))
    .addFields(
      { name: 'Member Count', value: `${guild.memberCount}`, inline: true },
      { name: 'Get Started', value: 'Read the rules and say hello in chat!', inline: true }
    )
    .setFooter({ text: config.footer || 'Welcome message', iconURL: config.footerIconUrl ?? undefined })
    .setTimestamp();

  if (config.imageUrl) {
    embed.setImage(config.imageUrl);
  }

  if (config.authorName) {
    embed.setAuthor({ name: config.authorName, iconURL: config.authorIconUrl ?? undefined });
  }

  return embed;
}