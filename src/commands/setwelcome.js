import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configure the welcome channel and embed message settings')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The text channel to send welcome messages to')
        .setRequired(true)
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
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please choose a text channel for welcome messages.',
        ephemeral: true
      });
      return;
    }

    const config = { welcomeChannelId: channel.id };
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

    setGuildConfig(interaction.guild.id, config);

    await interaction.reply({
      content: `Welcome settings updated for ${channel}.`,
      ephemeral: true
    });
  }
};
