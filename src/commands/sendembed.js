import { SlashCommandBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

export default {
  data: new SlashCommandBuilder()
    .setName('sendembed')
    .setDescription('Build and send a custom embed to a channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send the embed to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option.setName('title').setDescription('Embed title')
    )
    .addStringOption((option) =>
      option.setName('description').setDescription('Embed description')
    )
    .addStringOption((option) =>
      option.setName('color').setDescription('Embed color as hex, e.g. #00ff00')
    )
    .addStringOption((option) =>
      option.setName('image_url').setDescription('Large image URL for the embed')
    )
    .addStringOption((option) =>
      option.setName('thumbnail_url').setDescription('Thumbnail image URL for the embed')
    )
    .addStringOption((option) =>
      option.setName('footer').setDescription('Footer text for the embed')
    )
    .addStringOption((option) =>
      option.setName('footer_icon_url').setDescription('Footer icon URL for the embed')
    )
    .addStringOption((option) =>
      option.setName('author_name').setDescription('Author name for the embed')
    )
    .addStringOption((option) =>
      option.setName('author_icon_url').setDescription('Author icon URL for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('field1_name')
        .setDescription('First field name for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('field1_value')
        .setDescription('First field value for the embed')
    )
    .addBooleanOption((option) =>
      option
        .setName('field1_inline')
        .setDescription('Use inline layout for first field?')
    )
    .addStringOption((option) =>
      option
        .setName('field2_name')
        .setDescription('Second field name for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('field2_value')
        .setDescription('Second field value for the embed')
    )
    .addBooleanOption((option) =>
      option
        .setName('field2_inline')
        .setDescription('Use inline layout for second field?')
    )
    .addStringOption((option) =>
      option
        .setName('field3_name')
        .setDescription('Third field name for the embed')
    )
    .addStringOption((option) =>
      option
        .setName('field3_value')
        .setDescription('Third field value for the embed')
    )
    .addBooleanOption((option) =>
      option
        .setName('field3_inline')
        .setDescription('Use inline layout for third field?')
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please choose a text channel to send the embed to.',
        ephemeral: true
      });
      return;
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

    const embed = new EmbedBuilder();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (color) {
      const parsed = parseColor(color);
      if (parsed) embed.setColor(parsed);
    }
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
    if (imageUrl) embed.setImage(imageUrl);
    if (footer) embed.setFooter({ text: footer, iconURL: footerIconUrl ?? undefined });
    if (authorName) embed.setAuthor({ name: authorName, iconURL: authorIconUrl ?? undefined });

    const fields = [];
    for (let index = 1; index <= 3; index += 1) {
      const fieldName = interaction.options.getString(`field${index}_name`);
      const fieldValue = interaction.options.getString(`field${index}_value`);
      const fieldInline = interaction.options.getBoolean(`field${index}_inline`);
      if (fieldName && fieldValue) {
        fields.push({ name: fieldName, value: fieldValue, inline: Boolean(fieldInline) });
      }
    }
    if (fields.length > 0) embed.addFields(fields);

    if (!embed.data.title && !embed.data.description && !embed.data.fields?.length && !embed.data.image && !embed.data.thumbnail) {
      await interaction.reply({
        content: 'Please provide at least one embed field such as title, description, or image.',
        ephemeral: true
      });
      return;
    }

    const sentMessage = await channel.send({ embeds: [embed] });
    setGuildConfig(interaction.guild.id, {
      lastEmbed: {
        channelId: channel.id,
        messageId: sentMessage.id
      }
    });

    await interaction.reply({
      content: `Custom embed sent to ${channel}. You can edit it later with /editembed.`,
      ephemeral: true
    });
  }
};
