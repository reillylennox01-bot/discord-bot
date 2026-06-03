import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

export default {
  data: new SlashCommandBuilder()
    .setName('welcomepreview')
    .setDescription('Preview the current welcome embed settings'),
  async execute(interaction) {
    const config = getGuildConfig(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(parseColor(config.color) ?? 0x00ff00)
      .setTitle(config.title || `Welcome to ${interaction.guild.name}!`)
      .setDescription(
        config.description || `Hello ${interaction.user}, welcome to **${interaction.guild.name}**! We're happy to have you here.`
      )
      .setThumbnail(
        config.thumbnailUrl || interaction.user.displayAvatarURL({ extension: 'png', size: 512 })
      )
      .addFields(
        { name: 'Member Count', value: `${interaction.guild.memberCount}`, inline: true },
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

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
