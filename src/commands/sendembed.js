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

function buildSlotPickerComponents(selectedSlot = null, channelId = null) {
  const firstRow = [];
  for (let index = 1; index <= 5; index += 1) {
    const buttonId = channelId ? `sendembed_slot:${index}:${channelId}` : `sendembed_slot:${index}`;
    firstRow.push(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  const secondRow = [];
  for (let index = 6; index <= 10; index += 1) {
    const buttonId = channelId ? `sendembed_slot:${index}:${channelId}` : `sendembed_slot:${index}`;
    secondRow.push(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  const previewButton = new ButtonBuilder()
    .setCustomId(channelId ? `sendembed_preview:${channelId}` : 'sendembed_preview')
    .setLabel('Preview Embeds')
    .setStyle(ButtonStyle.Secondary);

  const sendButton = new ButtonBuilder()
    .setCustomId(channelId ? `sendembed_send:${channelId}` : 'sendembed_send')
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

    const sendNow = interaction.options.getBoolean('send_now') || false;
    const guildConfig = getGuildConfig(interaction.guild.id);
    const pendingEmbeds = guildConfig.pendingEmbeds || {};
    const channelPendingEmbeds = pendingEmbeds[channel.id] || { channelId: channel.id, embeds: Array.from({ length: 10 }, () => null) };

    if (sendNow) {
      const updatedEmbeds = channelPendingEmbeds.embeds;
      const embedsToSend = updatedEmbeds
        .filter((data) => hasEmbedContent(data))
        .map((data) => buildEmbedFromData(data));

      if (!embedsToSend.length) {
        await interaction.reply({
          content: 'No saved embeds were found for this channel yet.',
          components: buildSlotPickerComponents(null, channel.id),
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
        components: buildSlotPickerComponents(null, channel.id),
        ephemeral: true
      });
      return;
    }

    setGuildConfig(interaction.guild.id, {
      pendingEmbeds: guildConfig.pendingEmbeds || {}
    });

    await interaction.reply({
      content: `Choose a slot to edit embeds for ${channel}. Click a slot to open the editor.`,
      components: buildSlotPickerComponents(null, channel.id),
      ephemeral: true
    });
  }
};
