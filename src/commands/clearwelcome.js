import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clearwelcome')
    .setDescription('Clear the saved welcome message and recent welcome posts in the welcome channel'),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: 'You need Administrator permission to clear the welcome message.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guild.id;
    const currentConfig = getGuildConfig(guildId);
    const welcomeChannelId = currentConfig.welcomeChannelId || null;
    let welcomeChannel = welcomeChannelId
      ? await interaction.guild.channels.fetch(welcomeChannelId).catch(() => null)
      : null;

    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      welcomeChannel =
        interaction.guild.channels.cache.find(
          (channel) => channel.name === 'welcome' && channel.isTextBased()
        ) || interaction.guild.systemChannel;
    }

    setGuildConfig(guildId, {
      welcomeChannelId: null,
      sendDM: false,
      title: null,
      description: null,
      color: null,
      imageUrl: null,
      thumbnailUrl: null,
      footer: null,
      footerIconUrl: null,
      authorName: null,
      authorIconUrl: null,
      welcomeEmbeds: []
    });

    let deletedCount = 0;
    let statusMessage = 'Welcome configuration cleared.';

    if (welcomeChannel && welcomeChannel.isTextBased()) {
      let before;
      let hasMore = true;

      while (hasMore) {
        const messages = await welcomeChannel.messages.fetch({ limit: 100, before }).catch(() => new Map());
        if (messages.size === 0) break;

        const welcomeMessages = [...messages.values()].filter((message) => {
          if (message.author.id !== interaction.client.user.id) return false;
          return message.content.includes('<@') || message.embeds.length > 0 || /welcome/i.test(message.content);
        });

        for (const message of welcomeMessages) {
          const deleted = await message.delete().then(() => true).catch(() => false);
          if (deleted) deletedCount += 1;
        }

        before = [...messages.values()].reduce((oldest, message) =>
          !oldest || message.createdTimestamp < oldest.createdTimestamp ? message : oldest
        ).id;
        hasMore = messages.size === 100;
      }

      statusMessage = deletedCount > 0
        ? `Welcome configuration cleared and ${deletedCount} welcome post${deletedCount === 1 ? '' : 's'} removed.`
        : 'Welcome configuration cleared. No welcome posts were found to remove.';
    } else {
      statusMessage = 'Welcome configuration cleared. The welcome channel could not be accessed, so no posts were removed.';
    }

    await interaction.editReply({ content: statusMessage });
  }
};
