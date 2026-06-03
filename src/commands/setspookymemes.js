import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setspookymemes')
    .setDescription('Configure spooky meme delivery at 3AM and enable or disable it')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel where spooky memes will be sent')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption((option) =>
      option
        .setName('enabled')
        .setDescription('Enable or disable 3AM spooky meme delivery')
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);
    const updates = {};

    if (channel) {
      if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'Please choose a text channel for spooky memes.',
          ephemeral: true
        });
        return;
      }
      updates.spookyMemeChannelId = channel.id;
    }

    if (enabled !== null) {
      updates.spookyMemeEnabled = enabled;
    }

    if (Object.keys(updates).length === 0) {
      await interaction.reply({
        content: `Current spooky meme settings:
- Channel: ${config.spookyMemeChannelId ? `<#${config.spookyMemeChannelId}>` : 'not set'}
- Status: ${config.spookyMemeEnabled ? 'enabled' : 'disabled'}`,
        ephemeral: true
      });
      return;
    }

    if (updates.spookyMemeEnabled === true && !updates.spookyMemeChannelId && !config.spookyMemeChannelId) {
      await interaction.reply({
        content: 'You must set a channel before enabling spooky memes. Use `/setspookymemes channel:#your-channel enabled:true`.',
        ephemeral: true
      });
      return;
    }

    setGuildConfig(guildId, updates);

    const parts = [];
    if (updates.spookyMemeChannelId) parts.push(`channel set to <#${updates.spookyMemeChannelId}>`);
    if (updates.spookyMemeEnabled !== undefined) parts.push(`spooky memes ${updates.spookyMemeEnabled ? 'enabled' : 'disabled'}`);

    await interaction.reply({
      content: `Spooky meme settings updated: ${parts.join(', ')}.`,
      ephemeral: true
    });
  }
};
