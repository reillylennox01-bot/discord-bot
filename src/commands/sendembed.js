import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

function buildEmbedFromData(data) {
  const embed = new EmbedBuilder();

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (data.color) {
    const parsed = parseColor(data.color);
    if (parsed) embed.setColor(parsed);
  }
  if (data.thumbnail_url || data.thumbnailUrl) embed.setThumbnail(data.thumbnail_url || data.thumbnailUrl);
  if (data.image_url || data.imageUrl) embed.setImage(data.image_url || data.imageUrl);
  if (data.footer) embed.setFooter({ text: data.footer, iconURL: data.footer_icon_url ?? data.footerIconUrl ?? undefined });
  if (data.author_name || data.authorName) {
    embed.setAuthor({
      name: data.author_name || data.authorName,
      iconURL: data.author_icon_url ?? data.authorIconUrl ?? undefined
    });
  }

  const fields = Array.isArray(data.fields) ? data.fields : [];
  if (fields.length > 0) {
    embed.addFields(
      fields
        .filter((field) => field.name && field.value)
        .map((field) => ({
          name: field.name,
          value: String(field.value),
          inline: Boolean(field.inline)
        }))
    );
  }

  return embed;
}

function hasEmbedContent(data) {
  return Boolean(
    data?.title ||
      data?.description ||
      data?.image_url ||
      data?.imageUrl ||
      data?.thumbnail_url ||
      data?.thumbnailUrl ||
      data?.author_name ||
      data?.authorName ||
      (Array.isArray(data?.fields) && data.fields.some((field) => field?.name && field?.value))
  );
}

function buildSlotPickerComponents(selectedSlot = null, channelId = null, messageId = null) {
  const firstRow = [];
  for (let index = 1; index <= 5; index += 1) {
    let buttonId = `sendembed_slot:${index}`;
    if (channelId) buttonId += `:${channelId}`;
    if (messageId) buttonId += `:${messageId}`;
    firstRow.push(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  const secondRow = [];
  for (let index = 6; index <= 10; index += 1) {
    let buttonId = `sendembed_slot:${index}`;
    if (channelId) buttonId += `:${channelId}`;
    if (messageId) buttonId += `:${messageId}`;
    secondRow.push(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  let previewId = 'sendembed_preview';
  let sendId = 'sendembed_send';
  if (channelId) {
    previewId += `:${channelId}`;
    sendId += `:${channelId}`;
  }
  if (messageId) {
    previewId += `:${messageId}`;
    sendId += `:${messageId}`;
  }

  const previewButton = new ButtonBuilder()
    .setCustomId(previewId)
    .setLabel('Preview Embeds')
    .setStyle(ButtonStyle.Secondary);

  const sendButton = new ButtonBuilder()
    .setCustomId(sendId)
    .setLabel('Send All Embeds Now')
    .setStyle(ButtonStyle.Success);

  const thirdRow = new ActionRowBuilder().addComponents(previewButton, sendButton);

  return [
    new ActionRowBuilder().addComponents(...firstRow),
    new ActionRowBuilder().addComponents(...secondRow),
    thirdRow
  ];
}

export default {
  data: new SlashCommandBuilder()
    .setName('sendembed')
    .setDescription('Build up to 10 embeds for one message by saving slot-by-slot')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send the embeds to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option.setName('message_id').setDescription('Message ID to update with selected embed slot (optional)')
    )
    .addBooleanOption((option) => option.setName('send_now').setDescription('Send all saved embeds for this channel in one message')),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please choose a text channel to send the embeds to.',
        ephemeral: true
      });
      return;
    }

    const messageIdOption = interaction.options.getString('message_id');
    const sendNow = interaction.options.getBoolean('send_now') || false;
    const guildConfig = getGuildConfig(interaction.guild.id);
    const pendingEmbeds = guildConfig.pendingEmbeds || {};
    const channelPendingEmbeds = pendingEmbeds[channel.id] || { channelId: channel.id, embeds: Array.from({ length: 10 }, () => null) };

    // If message_id is provided, verify it exists
    let targetMessage = null;
    if (messageIdOption) {
      targetMessage = await channel.messages.fetch(messageIdOption).catch(() => null);
      if (!targetMessage) {
        await interaction.reply({
          content: `Could not find message with ID \`${messageIdOption}\` in ${channel}.`,
          ephemeral: true
        });
        return;
      }
    }

    if (sendNow) {
      const updatedEmbeds = channelPendingEmbeds.embeds;
      const embedsToSend = updatedEmbeds
        .filter((data) => hasEmbedContent(data))
        .map((data) => buildEmbedFromData(data));

      if (!embedsToSend.length) {
        await interaction.reply({
          content: 'No saved embeds were found for this channel yet.',
          components: buildSlotPickerComponents(null, channel.id, messageIdOption),
          ephemeral: true
        });
        return;
      }

      const sentMessage = await channel.send({ embeds: embedsToSend });
      setGuildConfig(interaction.guild.id, {
        lastEmbed: {
          channelId: channel.id,
          messageId: sentMessage.id
        },
        pendingEmbeds: {
          ...pendingEmbeds,
          [channel.id]: {
            ...channelPendingEmbeds,
            embeds: Array.from({ length: 10 }, () => null)
          }
        }
      });

      await interaction.reply({
        content: `Sent ${embedsToSend.length} embed${embedsToSend.length === 1 ? '' : 's'} to ${channel} in one message. Choose a slot below to build more.`,
        components: buildSlotPickerComponents(null, channel.id, messageIdOption),
        ephemeral: true
      });
      return;
    }

    setGuildConfig(interaction.guild.id, {
      pendingEmbeds: guildConfig.pendingEmbeds || {}
    });

    const replyContent = messageIdOption
      ? `Choose a slot to edit embeds for ${channel}. Selected embed will update [that message](${targetMessage.url}).`
      : `Choose a slot to edit embeds for ${channel}. Click a slot to open the editor.`;

    await interaction.reply({
      content: replyContent,
      components: buildSlotPickerComponents(null, channel.id, messageIdOption),
      ephemeral: true,
      allowedMentions: { parse: [] }
    });
  }
};
