import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
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
    .setDescription('Edit an embed in a message (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel containing the embed message')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('message_id')
        .setDescription('The ID of the message with the embed to edit')
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('resend_to')
        .setDescription('Send all embeds from this message to another channel')
        .addChannelTypes(ChannelType.GuildText)
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
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const messageId = interaction.options.getString('message_id');
    const resendTo = interaction.options.getChannel('resend_to');

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'Please specify a valid text channel.', ephemeral: true });
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.reply({ content: `Could not find message with ID \`${messageId}\` in ${channel}.`, ephemeral: true });
      return;
    }

    if (!message.author || message.author.id !== interaction.client.user.id) {
      await interaction.reply({ content: 'I can only edit embeds that I created.', ephemeral: true });
      return;
    }

    if (!message.embeds || message.embeds.length === 0) {
      await interaction.reply({ content: 'That message does not contain any embeds to edit.', ephemeral: true });
      return;
    }

    // Handle resend
    if (resendTo) {
      if (!resendTo.isTextBased()) {
        await interaction.reply({ content: 'Please specify a text channel to resend to.', ephemeral: true });
        return;
      }

      try {
        // Convert embeds to EmbedBuilder to preserve all data
        const embeds = message.embeds.map(embedData => {
          const embed = new EmbedBuilder();
          if (embedData.title) embed.setTitle(embedData.title);
          if (embedData.description) embed.setDescription(embedData.description);
          if (embedData.color) embed.setColor(embedData.color);
          if (embedData.url) embed.setURL(embedData.url);
          if (embedData.timestamp) embed.setTimestamp(embedData.timestamp);
          if (embedData.image?.url) embed.setImage(embedData.image.url);
          if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
          if (embedData.footer?.text) embed.setFooter({ text: embedData.footer.text, iconURL: embedData.footer.iconURL ?? undefined });
          if (embedData.author?.name) embed.setAuthor({ name: embedData.author.name, iconURL: embedData.author.iconURL ?? undefined, url: embedData.author.url ?? undefined });
          if (embedData.fields?.length) embed.addFields(embedData.fields.map((field) => ({ name: field.name, value: field.value, inline: field.inline ?? false })));
          return embed;
        });

        await resendTo.send({ embeds });
        await interaction.reply({
          content: `✅ Resent ${message.embeds.length} embed${message.embeds.length === 1 ? '' : 's'} to ${resendTo}`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error resending embeds:', error);
        await interaction.reply({ content: 'Failed to resend embeds. Check my permissions in that channel.', ephemeral: true });
      }
      return;
    }

    // Check if any optional parameters were provided
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const imageUrl = interaction.options.getString('image_url');
    const thumbnailUrl = interaction.options.getString('thumbnail_url');
    const footer = interaction.options.getString('footer');
    const footerIconUrl = interaction.options.getString('footer_icon_url');
    const authorName = interaction.options.getString('author_name');
    const authorIconUrl = interaction.options.getString('author_icon_url');

    const hasQuickEdits = title !== null || description !== null || color !== null || imageUrl !== null || thumbnailUrl !== null || footer !== null || authorName !== null || authorIconUrl !== null;

    // If message has only 1 embed and no quick edits, show picker UI
    if (message.embeds.length === 1 && !hasQuickEdits) {
      const modal = new ModalBuilder()
        .setCustomId(`editembed_modal:${channel.id}:${messageId}:0`)
        .setTitle('Edit Embed');

      const existingEmbed = message.embeds[0];
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(existingEmbed.title || '')
        .setRequired(false);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(existingEmbed.description || '')
        .setRequired(false);

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (hex, e.g. #00ff00)')
        .setStyle(TextInputStyle.Short)
        .setValue((existingEmbed.color?.toString(16) || '').padStart(6, '0'))
        .setRequired(false);

      const imageUrlInput = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel('Image URL')
        .setStyle(TextInputStyle.Short)
        .setValue(existingEmbed.image?.url || '')
        .setRequired(false);

      const thumbnailUrlInput = new TextInputBuilder()
        .setCustomId('thumbnail_url')
        .setLabel('Thumbnail URL')
        .setStyle(TextInputStyle.Short)
        .setValue(existingEmbed.thumbnail?.url || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageUrlInput),
        new ActionRowBuilder().addComponents(thumbnailUrlInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // If multiple embeds, show embed picker
    if (message.embeds.length > 1 && !hasQuickEdits) {
      const firstRow = [];
      for (let index = 0; index < Math.min(5, message.embeds.length); index += 1) {
        firstRow.push(
          new ButtonBuilder()
            .setCustomId(`editembed_select:${channel.id}:${messageId}:${index}`)
            .setLabel(`Embed ${index + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      }

      const rows = [new ActionRowBuilder().addComponents(...firstRow)];

      if (message.embeds.length > 5) {
        const secondRow = [];
        for (let index = 5; index < Math.min(10, message.embeds.length); index += 1) {
          secondRow.push(
            new ButtonBuilder()
              .setCustomId(`editembed_select:${channel.id}:${messageId}:${index}`)
              .setLabel(`Embed ${index + 1}`)
              .setStyle(ButtonStyle.Primary)
          );
        }
        rows.push(new ActionRowBuilder().addComponents(...secondRow));
      }

      // Add resend button
      const resendRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`editembed_resend:${channel.id}:${messageId}`)
          .setLabel('Resend Message')
          .setStyle(ButtonStyle.Secondary)
      );
      rows.push(resendRow);

      await interaction.reply({
        content: `This message has **${message.embeds.length}** embeds. Choose which one to edit:`,
        components: rows,
        ephemeral: true
      });
      return;
    }

    // Handle quick edits
    const existingEmbed = message.embeds[0];
    const embed = buildEmbedFromExisting(existingEmbed.data);

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

    const embeds = [...message.embeds];
    embeds[0] = embed;
    
    await message.edit({ embeds });
    await interaction.reply({ content: 'Embed updated successfully.', ephemeral: true });
  }
};
