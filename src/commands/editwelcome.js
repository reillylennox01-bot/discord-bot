import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return normalized;
}

export default {
  data: new SlashCommandBuilder()
    .setName('editwelcome')
    .setDescription('Edit the welcome message settings for this server')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The text channel for welcome messages')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Welcome embed title')
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Welcome embed description')
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Embed color hex code, like #00ff00')
    )
    .addStringOption((option) =>
      option
        .setName('image_url')
        .setDescription('Large image URL for the welcome embed')
    )
    .addStringOption((option) =>
      option
        .setName('thumbnail_url')
        .setDescription('Thumbnail image URL for the welcome embed')
    )
    .addStringOption((option) =>
      option
        .setName('footer')
        .setDescription('Footer text for the welcome embed')
    )
    .addStringOption((option) =>
      option
        .setName('footer_icon_url')
        .setDescription('Footer icon URL for the welcome embed')
    )
    .addStringOption((option) =>
      option
        .setName('author_name')
        .setDescription('Author name for the welcome embed')
    )
    .addStringOption((option) =>
      option
        .setName('author_icon_url')
        .setDescription('Author icon URL for the welcome embed')    )
    .addBooleanOption((option) =>
      option
        .setName('send_dm')
        .setDescription('Also send the welcome embed to the member via DM')    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const currentConfig = getGuildConfig(guildId);
    const config = {};

    const channel = interaction.options.getChannel('channel');
    if (channel) {
      if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Please select a text channel for welcome messages.', ephemeral: true });
        return;
      }
      config.welcomeChannelId = channel.id;
    }

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

    if (title !== null) config.title = title;
    if (description !== null) config.description = description;
    if (color !== null) {
      const normalized = parseColor(color);
      if (!normalized) {
        await interaction.reply({ content: 'Please provide a valid hex color like #00ff00.', ephemeral: true });
        return;
      }
      config.color = `#${normalized}`;
    }
    if (imageUrl !== null) config.imageUrl = imageUrl;
    if (thumbnailUrl !== null) config.thumbnailUrl = thumbnailUrl;
    if (footer !== null) config.footer = footer;
    if (footerIconUrl !== null) config.footerIconUrl = footerIconUrl;
    if (authorName !== null) config.authorName = authorName;
    if (authorIconUrl !== null) config.authorIconUrl = authorIconUrl;
    if (sendDM !== null) config.sendDM = sendDM;

    if (Object.keys(config).length === 0) {
      await interaction.reply({ content: 'No changes provided. Use one or more options to edit your welcome message.', ephemeral: true });
      return;
    }

    setGuildConfig(guildId, config);

    const updatedFields = Object.keys(config)
      .map((key) => ` ${key}`)
      .join('\n');

    await interaction.reply({
      content: `Welcome message settings updated.${updatedFields ? '\n' + updatedFields : ''}`,
      ephemeral: true
    });
  }
};
