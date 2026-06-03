import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setstreamer')
    .setDescription('Set a Twitch streamer and notification channel for live alerts')
    .addStringOption((option) =>
      option
        .setName('streamer')
        .setDescription('Twitch username to monitor')
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Discord channel to send Twitch live notifications to')
        .setRequired(true)
    ),
  async execute(interaction) {
    const streamer = interaction.options.getString('streamer');
    const channel = interaction.options.getChannel('channel');

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please choose a text channel for Twitch notifications.',
        ephemeral: true
      });
      return;
    }

    setGuildConfig(interaction.guild.id, {
      twitchStreamer: streamer.toLowerCase(),
      twitchNotifyChannelId: channel.id
    });

    await interaction.reply({
      content: `Twitch notifications set for **${streamer}** in ${channel}.`,
      ephemeral: true
    });
  }
};
