import { SlashCommandBuilder } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('disabletwitch')
    .setDescription('Disable Twitch live notifications for this server'),
  async execute(interaction) {
    setGuildConfig(interaction.guild.id, {
      twitchStreamer: null,
      twitchNotifyChannelId: null,
      twitchNotifyRoleId: null
    });

    await interaction.reply({
      content: 'Twitch live notifications have been disabled for this server.',
      ephemeral: true
    });
  }
};
