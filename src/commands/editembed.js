import { SlashCommandBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

function parseMessageId(value) {
  if (!value) return null;
  const match = value.match(/(\d{17,19})$/);
  return match ? match[1] : value;
}

function buildEmbedFromExisting(existingEmbed) {
  const embed = new EmbedBuilder();
  if (existingEmbed.title) embed.setTitle(existingEmbed.title);
  if (existingEmbed.description) embed.setDescription(existingEmbed.description);
  if (existingEmbed.color) embed.setColor(existingEmbed.color);
  if (existingEmbed.url) embed.setURL(existingEmbed.url);
  if (existingEmbed.timestamp) embed.setTimestamp(existingEmbed.timestamp);
  if (existingEmbed.image?.url) embed.setImage(existingEmbed.image.url);
  if (existingEmbed.thumbnail?.url) embed.setThumbnail(existingEmbed.thumbnail.url);
  if (existingEmbed.footer?.text) embed.setFooter({ text: existingEmbed.footer.text, iconURL: existingEmbed.footer.iconURL ?? undefined });
  if (existingEmbed.author?.name) embed.setAuthor({ name: existingEmbed.author.name, iconURL: existingEmbed.author.iconURL ?? undefined });
  if (existingEmbed.fields?.length) embed.addFields(existingEmbed.fields.map((field) => ({ name: field.name, value: field.value, inline: field.inline ?? false })));
  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('editembed')
    .setDescription('Edit the last embed sent by the bot or a specific embed message')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel containing the embed message')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('message_id')
        .setDescription('The ID or link of the embed message to edit')
    )
    .addStringOption((option) =>
      option.setName('title').setDescription('Update embed title')
    )
    .addStringOption((option) =>
      option.setName('description').setDescription('Update embed description')
    )
    .addStringOption((option) =>
      option.setName('color').setDescription('Update embed color hex code, like #00ff00')
    )
    .addStringOption((option) =>
      option.setName('image_url').setDescription('Update embed image URL')
    )
    .addStringOption((option) =>
      option.setName('thumbnail_url').setDescription('Update embed thumbnail URL')
    )
    .addStringOption((option) =>
      option.setName('footer').setDescription('Update embed footer text')
    )
    .addStringOption((option) =>
      option.setName('footer_icon_url').setDescription('Update embed footer icon URL')
    )
    .addStringOption((option) =>
      option.setName('author_name').setDescription('Update embed author name')
    )
    .addStringOption((option) =>
      option.setName('author_icon_url').setDescription('Update embed author icon URL')
    )
    .addStringOption((option) =>
      option.setName('field1_name').setDescription('Field 1 title')
    )
    .addStringOption((option) =>
      option.setName('field1_value').setDescription('Field 1 value')
    )
    .addBooleanOption((option) =>
      option.setName('field1_inline').setDescription('Field 1 inline?')
    )
    .addStringOption((option) =>
      option.setName('field2_name').setDescription('Field 2 title')
    )
    .addStringOption((option) =>
      option.setName('field2_value').setDescription('Field 2 value')
    )
    .addBooleanOption((option) =>
      option.setName('field2_inline').setDescription('Field 2 inline?')
    )
    .addStringOption((option) =>
      option.setName('field3_name').setDescription('Field 3 title')
    )
    .addStringOption((option) =>
      option.setName('field3_value').setDescription('Field 3 value')
    )
    .addBooleanOption((option) =>
      option.setName('field3_inline').setDescription('Field 3 inline?')
    )
    .addBooleanOption((option) =>
      option.setName('clear_fields')
        .setDescription('Clear all existing embed fields before editing')
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const channel = interaction.options.getChannel('channel');
    const messageIdOption = interaction.options.getString('message_id');

    const config = getGuildConfig(guildId);
    const lastEmbed = config.lastEmbed;

    const targetChannel = channel || (lastEmbed ? await interaction.guild.channels.fetch(lastEmbed.channelId).catch(() => null) : null);
    const targetMessageId = messageIdOption ? parseMessageId(messageIdOption) : lastEmbed?.messageId;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({ content: 'Please specify the text channel containing the embed message or send an embed first.', ephemeral: true });
      return;
    }

    if (!targetMessageId) {
      await interaction.reply({ content: 'Please provide a message ID or send an embed first so the bot can remember the message.', ephemeral: true });
      return;
    }

    const message = await targetChannel.messages.fetch(targetMessageId).catch(() => null);
    if (!message) {
      await interaction.reply({ content: 'Could not find that message in the selected channel.', ephemeral: true });
      return;
    }

    if (!message.author || message.author.id !== interaction.client.user.id) {
      await interaction.reply({ content: 'I can only edit embeds that I created.', ephemeral: true });
      return;
    }

    const existingEmbed = message.embeds[0];
    if (!existingEmbed) {
      await interaction.reply({ content: 'That message does not contain an embed to edit.', ephemeral: true });
      return;
    }

    const embed = buildEmbedFromExisting(existingEmbed.data);

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const imageUrl = interaction.options.getString('image_url');
    const thumbnailUrl = interaction.options.getString('thumbnail_url');
    const footer = interaction.options.getString('footer');
    const footerIconUrl = interaction.options.getString('footer_icon_url');
    const authorName = interaction.options.getString('author_name');
    const authorIconUrl = interaction.options.getString('author_icon_url');
    const clearFields = interaction.options.getBoolean('clear_fields');

    if (title !== null) embed.setTitle(title);
    if (description !== null) embed.setDescription(description);
    if (color !== null) {
      const parsed = parseColor(color);
      if (!parsed) {
        await interaction.reply({ content: 'Please provide a valid hex color like #00ff00.', ephemeral: true });
        return;
      }
      embed.setColor(parsed);
    }
    if (thumbnailUrl !== null) {
      embed.setThumbnail(thumbnailUrl);
    }
    if (imageUrl !== null) {
      embed.setImage(imageUrl);
    }
    if (footer !== null) {
      embed.setFooter({ text: footer, iconURL: footerIconUrl ?? undefined });
    }
    if (authorName !== null) {
      embed.setAuthor({ name: authorName, iconURL: authorIconUrl ?? undefined });
    }
    if (authorIconUrl !== null && authorName === null && existingEmbed.author) {
      embed.setAuthor({ name: existingEmbed.author.name, iconURL: authorIconUrl });
    }

    if (clearFields) {
      embed.setFields([]);
    }

    const updatedFields = [];
    for (let index = 1; index <= 3; index += 1) {
      const name = interaction.options.getString(`field${index}_name`);
      const value = interaction.options.getString(`field${index}_value`);
      const inline = interaction.options.getBoolean(`field${index}_inline`);
      if (name !== null || value !== null) {
        if (!name || !value) {
          await interaction.reply({ content: `Field ${index} requires both a name and a value.`, ephemeral: true });
          return;
        }
        updatedFields.push({ name, value, inline: Boolean(inline) });
      }
    }

    if (updatedFields.length > 0) {
      embed.data.fields = updatedFields;
    }

    if (
      title === null &&
      description === null &&
      color === null &&
      imageUrl === null &&
      thumbnailUrl === null &&
      footer === null &&
      authorName === null &&
      authorIconUrl === null &&
      !clearFields &&
      updatedFields.length === 0
    ) {
      await interaction.reply({ content: 'No edit options were provided. Use at least one option to update the embed.', ephemeral: true });
      return;
    }

    await message.edit({ embeds: [embed] });
    await interaction.reply({ content: 'Embed updated successfully.', ephemeral: true });
  }
};
