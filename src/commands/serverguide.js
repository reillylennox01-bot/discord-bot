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
    .setName('serverguide')
    .setDescription('Show the server guide embed with tips and rules'),

  async execute(interaction) {
    const config = getGuildConfig(interaction.guild.id).serverGuide || {};
    const fields = config.fields?.length
      ? config.fields
      : [
          { name: '📌 Rules', value: 'Be respectful, no spam, and follow the channel topics.', inline: false },
          { name: '💬 Chat Tips', value: 'Introduce yourself, ask questions, and share relevant content.', inline: false },
          { name: '🎮 Roles', value: 'Use `/rolehelp` or visit the roles channel to assign yourself roles.', inline: false },
          { name: '📢 Announcements', value: 'Check the announcements channel for updates and events.', inline: false },
          { name: '🆘 Need Help?', value: 'Ask a moderator or use `@Support` if you need assistance.', inline: false }
        ];

    const embed = new EmbedBuilder()
      .setTitle(config.title || 'Server Guide')
      .setDescription(config.description || 'Welcome! Here is a quick guide to help you get started in the server.')
      .addFields(fields)
      .setColor(parseColor(config.color) ?? 0x0099ff)
      .setFooter({ text: config.footer || 'Use this guide anytime with /serverguide' });

    await interaction.reply({ embeds: [embed] });
  }
};
