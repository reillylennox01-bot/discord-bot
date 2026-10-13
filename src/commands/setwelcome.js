import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';
import { buildWelcomeEmbed } from '../utils/welcomeEmbed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configure the welcome channel and embed message settings')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The text channel to send welcome messages to')
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Embed title for the welcome message')
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Embed description for the welcome message')
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Embed color as a hex code, e.g. #00ff00')
    )
    .addStringOption((option) =>
      option
        .setName('image_url')
        .setDescription('Large image URL for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('thumbnail_url')
        .setDescription('Thumbnail image URL for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('footer')
        .setDescription('Footer text for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('footer_icon_url')
        .setDescription('Footer icon URL for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('author_name')
        .setDescription('Author name for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('author_icon_url')
        .setDescription('Author icon URL for the embed')
    )
    .addBooleanOption((option) =>
      option
        .setName('send_dm')
        .setDescription('Also send the welcome embed to the member via DM')
    )
    .addBooleanOption((option) =>
      option
        .setName('preview')
        .setDescription('Preview the welcome embed after saving')
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guild.id;
    const currentConfig = getGuildConfig(guildId);
    const channel = interaction.options.getChannel('channel');
    if (channel && channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: 'Please choose a text channel for welcome messages.',
      });
      return;
    }

    const config = {};
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const imageUrl = interaction.options.getString('image_url');
    const thumbnailUrl = interaction.options.getString('thumbnail_url');
    const footer = interaction.options.getString('footer');
    const footerIconUrl = interaction.options.getString('footer_icon_url');
    const authorName = interaction.options.getString('author_name');
    const authorIconUrl = interaction.options.getString('author_icon_url');
    const sendDM = interaction.options.getBoolean('send_dm');
    const shouldPreview = interaction.options.getBoolean('preview') ?? false;
    const hasEmbedUpdates = [
      title,
      description,
      color,
      imageUrl,
      thumbnailUrl,
      footer,
      footerIconUrl,
      authorName,
      authorIconUrl
    ].some(Boolean);

    if (channel) config.welcomeChannelId = channel.id;
    if (title) config.title = title;
    if (description) config.description = description;
    if (color) config.color = color;
    if (imageUrl) config.imageUrl = imageUrl;
    if (thumbnailUrl) config.thumbnailUrl = thumbnailUrl;
    if (footer) config.footer = footer;
    if (footerIconUrl) config.footerIconUrl = footerIconUrl;
    if (authorName) config.authorName = authorName;
    if (authorIconUrl) config.authorIconUrl = authorIconUrl;
    if (sendDM !== null) config.sendDM = sendDM;

    if (Object.keys(config).length === 0 && !shouldPreview) {
      await interaction.editReply({
        content: 'No changes provided. Use one or more options to update or preview your welcome message.',
      });
      return;
    }

    if (!channel && !currentConfig.welcomeChannelId && !shouldPreview) {
      await interaction.editReply({
        content: 'Please choose a text channel for welcome messages.',
      });
      return;
    }

    const mergedConfig = {
      ...currentConfig,
      ...config
    };

    if (Object.keys(config).length > 0) {
      setGuildConfig(guildId, {
        ...config,
        welcomeEmbeds: [],
        ...(hasEmbedUpdates ? { welcomeEmbedCleared: false } : {})
      });
    }

    if (shouldPreview) {
      await interaction.channel.send({
        content: `Preview of the welcome message${mergedConfig.welcomeChannelId ? ` for <#${mergedConfig.welcomeChannelId}>` : ''}:`,
        embeds: [buildWelcomeEmbed(interaction.guild, interaction.user, mergedConfig)]
      });
    }

    await interaction.editReply({
      content: Object.keys(config).length > 0
        ? `Welcome settings updated${mergedConfig.welcomeChannelId ? ` for <#${mergedConfig.welcomeChannelId}>` : ''}.${shouldPreview ? ' Preview sent in this channel.' : ''}`
        : `Preview sent in this channel.`
    });
  }
};
