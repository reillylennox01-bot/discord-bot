import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

export default {
  name: 'welcomepreview',
  description: 'Preview the current welcome embed settings',
  async execute(message) {
    const config = getGuildConfig(message.guild.id);

    const embed = new EmbedBuilder()
      .setColor(parseColor(config.color) ?? 0x00ff00)
      .setTitle(config.title || `Welcome to ${message.guild.name}!`)
      .setDescription(config.description || `Hello ${message.author}, welcome to **${message.guild.name}**! We're happy to have you here.`)
      .setThumbnail(config.thumbnailUrl || message.author.displayAvatarURL({ extension: 'png', size: 512 }))
      .addFields(
        { name: 'Member Count', value: `${message.guild.memberCount}`, inline: true },
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

    await message.reply({ embeds: [embed] });
  }
};
