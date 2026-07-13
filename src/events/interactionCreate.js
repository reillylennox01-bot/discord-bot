import { getButtonRolesConfig, findButtonRole } from '../utils/buttonRoles.js';
import { setGuildConfig, getGuildConfig } from '../utils/settings.js';
import {
  getTicketConfig,
  addOpenTicket,
  removeOpenTicket,
  findTicketOwnerByChannel
} from '../utils/tickets.js';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  Collection
} from 'discord.js';
import { buildWelcomeEmbed, buildWelcomeEmbeds } from '../utils/welcomeEmbed.js';

function parseColor(value) {
  if (!value) return null;
  const hex = value.replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return parseInt(hex, 16);
}

function normalizeHttpUrl(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function formatWelcomeFieldsForInput(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return '';
  }

  return fields
    .filter((field) => field?.name && field?.value)
    .map((field) => `${field.name} | ${field.value} | ${field.inline ? 'inline' : 'block'}`)
    .join('\n');
}

function formatWelcomeIconUrlsForInput(data) {
  const lines = [];

  if (data?.footer_icon_url) {
    lines.push(`Footer: ${data.footer_icon_url}`);
  }

  if (data?.author_icon_url) {
    lines.push(`Author: ${data.author_icon_url}`);
  }

  return lines.join('\n');
}

function parseWelcomeIconUrlsInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      footerIconUrl: null,
      authorIconUrl: null
    };
  }

  const result = {
    footerIconUrl: null,
    authorIconUrl: null
  };

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error('Icon URLs must be written as Footer: https://... or Author: https://...');
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const rawUrl = line.slice(separatorIndex + 1).trim();

    if (!rawUrl) {
      continue;
    }

    const normalizedUrl = normalizeHttpUrl(rawUrl);
    if (!normalizedUrl) {
      throw new Error('Please provide valid icon URLs starting with http:// or https://');
    }

    if (key === 'footer') {
      result.footerIconUrl = normalizedUrl;
      continue;
    }

    if (key === 'author') {
      result.authorIconUrl = normalizedUrl;
      continue;
    }

    throw new Error('Icon URL lines must start with Footer: or Author:');
  }

  return result;
}

function parseWelcomeFieldsInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error('Each field line must be in the format: Name | Value | inline');
      }

      const inlineValue = (parts[2] || '').toLowerCase();
      return {
        name: parts[0],
        value: parts[1],
        inline: inlineValue === 'inline' || inlineValue === 'true' || inlineValue === 'yes'
      };
    });
}

function buildEmbedFromData(data) {
  const embed = new EmbedBuilder();

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (data.color) {
    const parsed = parseColor(data.color);
    if (parsed) embed.setColor(parsed);
  }
  if (data.thumbnail_url) embed.setThumbnail(data.thumbnail_url);
  if (data.image_url) embed.setImage(data.image_url);
  if (data.footer) {
    embed.setFooter({ text: data.footer, iconURL: data.footer_icon_url || undefined });
  }
  if (data.author_name) {
    embed.setAuthor({
      name: data.author_name,
      iconURL: data.author_icon_url || undefined
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

function hasEmbeddableContent(data) {
  return Boolean(
    data?.title ||
      data?.description ||
      data?.image_url ||
      data?.thumbnail_url ||
      data?.author_name ||
      (Array.isArray(data?.fields) && data.fields.some((field) => field?.name && field?.value))
  );
}

function buildTicketChannelName(user) {
  const baseName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'ticket';
  return `ticket-${baseName}-${user.id.slice(-4)}`;
}

function buildSlotPickerComponents(selectedSlot = null) {
  const firstRow = [];
  for (let index = 1; index <= 5; index += 1) {
    firstRow.push(
      new ButtonBuilder()
        .setCustomId(`sendembed_slot:${index}`)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  const secondRow = [];
  for (let index = 6; index <= 10; index += 1) {
    secondRow.push(
      new ButtonBuilder()
        .setCustomId(`sendembed_slot:${index}`)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  return [
    new ActionRowBuilder().addComponents(...firstRow),
    new ActionRowBuilder().addComponents(...secondRow)
  ];
}

function buildWelcomeEditorButtons() {
  const firstRowButtons = [];
  for (let index = 1; index <= 5; index += 1) {
    firstRowButtons.push(
      new ButtonBuilder()
        .setCustomId(`editwelcome_slot:${index}`)
        .setLabel(`Slot ${index}`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const secondRowButtons = [];
  for (let index = 6; index <= 10; index += 1) {
    secondRowButtons.push(
      new ButtonBuilder()
        .setCustomId(`editwelcome_slot:${index}`)
        .setLabel(`Slot ${index}`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const firstRow = new ActionRowBuilder().addComponents(...firstRowButtons);
  const secondRow = new ActionRowBuilder().addComponents(...secondRowButtons);

  const thirdRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('editwelcome_preview')
      .setLabel('Preview Embeds')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('editwelcome_send')
      .setLabel('Send All Embeds Now')
      .setStyle(ButtonStyle.Success)
  );

  return [firstRow, secondRow, thirdRow];
}

async function sendTranscript(channel, transcriptChannel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = sorted.map((message) => {
    const author = `${message.author.tag}`;
    const time = new Date(message.createdTimestamp).toLocaleString();
    let content = message.content || '';
    if (message.attachments.size > 0) {
      const attachments = message.attachments.map((att) => att.url).join(' ');
      content += content ? ` \nAttachments: ${attachments}` : `Attachments: ${attachments}`;
    }
    return `[${time}] ${author}: ${content}`;
  });

  const transcript = lines.join('\n') || 'No messages found.';
  const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: 'ticket-transcript.txt' });
  await transcriptChannel.send({ content: `Transcript for ${channel.name}`, files: [file] }).catch(() => null);
}

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId === 'editwelcome_preview') {
        const config = getGuildConfig(interaction.guild.id);
        const hasWelcomeEmbeds = Array.isArray(config.welcomeEmbeds) && config.welcomeEmbeds.some((embed) => embed);
        if (!hasWelcomeEmbeds) {
          await interaction.reply({ content: 'No saved embeds were found for welcome yet.', components: buildWelcomeEditorButtons(), ephemeral: true });
          return;
        }

        await interaction.reply({
          content: `**Preview** (${buildWelcomeEmbeds(interaction.guild, interaction.user, config).length} embed${buildWelcomeEmbeds(interaction.guild, interaction.user, config).length > 1 ? 's' : ''})`,
          embeds: buildWelcomeEmbeds(interaction.guild, interaction.user, config),
          ephemeral: true
        });
        return;
      }

      if (customId === 'editwelcome_send') {
        const config = getGuildConfig(interaction.guild.id);
        const hasWelcomeEmbeds = Array.isArray(config.welcomeEmbeds) && config.welcomeEmbeds.some((embed) => embed);
        if (!hasWelcomeEmbeds) {
          await interaction.reply({ content: 'No saved embeds were found for welcome yet.', components: buildWelcomeEditorButtons(), ephemeral: true });
          return;
        }

        const channelId = config.welcomeChannelId;
        if (!channelId) {
          await interaction.reply({ content: 'No welcome channel is configured yet. Run /setwelcome or /editwelcome channel:#your-channel first.', ephemeral: true });
          return;
        }

        const targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.reply({ content: 'Cannot access the configured welcome channel.', ephemeral: true });
          return;
        }

        const embeds = buildWelcomeEmbeds(interaction.guild, interaction.user, config);
        await targetChannel.send({ embeds });
        await interaction.reply({ content: `Sent ${embeds.length} welcome embed${embeds.length === 1 ? '' : 's'} to ${targetChannel}.`, ephemeral: true });
        return;
      }

      if (customId.startsWith('editwelcome_slot:')) {
        const slot = Number(customId.split(':')[1]);
        if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
          await interaction.reply({ content: 'That slot is not available.', ephemeral: true });
          return;
        }

        const currentConfig = getGuildConfig(interaction.guild.id);
        const currentEmbed = currentConfig.welcomeEmbeds?.[slot - 1] || {};
        const modal = new ModalBuilder()
          .setCustomId(`editwelcome_modal:${slot}`)
          .setTitle(`Edit Welcome Slot ${slot}`);

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.title || '')
          .setRequired(false);
        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentEmbed.description || '')
          .setRequired(false);
        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Color (hex, e.g. #00ff00)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.color || '')
          .setRequired(false);
        const imageInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.image_url || '')
          .setRequired(false);
        const thumbnailInput = new TextInputBuilder()
          .setCustomId('thumbnail_url')
          .setLabel('Thumbnail URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.thumbnail_url || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descriptionInput),
          new ActionRowBuilder().addComponents(colorInput),
          new ActionRowBuilder().addComponents(imageInput),
          new ActionRowBuilder().addComponents(thumbnailInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('editwelcome_advanced:')) {
        const slot = Number(customId.split(':')[1]);
        if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
          await interaction.reply({ content: 'That welcome slot is not available.', ephemeral: true });
          return;
        }

        const currentConfig = getGuildConfig(interaction.guild.id);
        const currentEmbed = currentConfig.welcomeEmbeds?.[slot - 1] || {};
        const modal = new ModalBuilder()
          .setCustomId(`editwelcome_advanced_modal:${slot}`)
          .setTitle(`Edit Welcome Advanced Options - Slot ${slot}`);

        const footerInput = new TextInputBuilder()
          .setCustomId('footer')
          .setLabel('Footer Text')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.footer || '')
          .setRequired(false);
        const authorNameInput = new TextInputBuilder()
          .setCustomId('author_name')
          .setLabel('Author Name')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.author_name || '')
          .setRequired(false);
        const iconUrlsInput = new TextInputBuilder()
          .setCustomId('icon_urls')
          .setLabel('Icon URLs (Footer / Author)')
          .setPlaceholder('Footer: https://...\nAuthor: https://...')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(formatWelcomeIconUrlsForInput(currentEmbed))
          .setRequired(false);
        const fieldsInput = new TextInputBuilder()
          .setCustomId('fields')
          .setLabel('Fields: Name | Value | inline')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(formatWelcomeFieldsForInput(currentEmbed.fields))
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(footerInput),
          new ActionRowBuilder().addComponents(authorNameInput),
          new ActionRowBuilder().addComponents(iconUrlsInput),
          new ActionRowBuilder().addComponents(fieldsInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (customId === 'setwelcome_preview') {
        const config = getGuildConfig(interaction.guild.id);
        const embed = buildWelcomeEmbed(interaction.guild, interaction.user, config);

        await interaction.reply({
          content: 'Here is how the welcome message will look:',
          embeds: [embed],
          ephemeral: true
        });
        return;
      }

      if (customId === 'ticket_open') {
        const guildId = interaction.guild.id;
        const ticketConfig = getTicketConfig(guildId);
        const existingChannelId = ticketConfig.openTickets?.[interaction.user.id];

        if (existingChannelId) {
          const existingChannel = await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
          if (existingChannel) {
            await interaction.reply({ content: `You already have an open ticket: ${existingChannel}`, ephemeral: true });
            return;
          }
          removeOpenTicket(guildId, interaction.user.id);
        }

        const channelName = buildTicketChannelName(interaction.user);
        const permissionOverwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.AddReactions
            ]
          }
        ];

        if (ticketConfig.staffRoleId) {
          permissionOverwrites.push({
            id: ticketConfig.staffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketConfig.categoryId || undefined,
          topic: `Ticket for ${interaction.user.tag} (${interaction.user.id})`,
          permissionOverwrites
        });

        addOpenTicket(guildId, interaction.user.id, ticketChannel.id);

        const closeButton = new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);
        const ticketEmbed = new EmbedBuilder()
          .setTitle(ticketConfig.ticketTitle || 'Ticket Opened')
          .setDescription(
            ticketConfig.ticketDescription ||
              'A staff member will be with you shortly. Press the button below to close this ticket when your issue is resolved.'
          )
          .setColor(ticketConfig.ticketColor ?? 0x00ff00)
          .setFooter({ text: ticketConfig.ticketFooter || 'Thank you for contacting support.' });

        if (ticketConfig.ticketImageUrl) {
          ticketEmbed.setImage(ticketConfig.ticketImageUrl);
        }

        if (ticketConfig.ticketFields?.length) {
          for (const field of ticketConfig.ticketFields) {
            if (!field.name || !field.value) continue;
            ticketEmbed.addFields({ name: field.name, value: field.value, inline: !!field.inline });
          }
        }

        ticketEmbed.addFields(
          { name: 'Requester', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
        )
          .setTimestamp();

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [row] });
        await interaction.reply({ content: `Your ticket has been opened: ${ticketChannel}`, ephemeral: true });
        return;
      }

      if (customId === 'ticket_close') {
        const guildId = interaction.guild.id;
        const ownerId = findTicketOwnerByChannel(guildId, interaction.channel.id);
        if (!ownerId) {
          await interaction.reply({ content: 'This button can only be used inside an active ticket channel.', ephemeral: true });
          return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const ticketConfig = getTicketConfig(guildId);
        const isOwner = interaction.user.id === ownerId;
        const isStaff = ticketConfig.staffRoleId && member?.roles?.cache?.has(ticketConfig.staffRoleId);
        const canManage = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!isOwner && !isStaff && !canManage) {
          await interaction.reply({ content: 'You are not allowed to close this ticket.', ephemeral: true });
          return;
        }

        const transcriptChannelId = ticketConfig.transcriptChannelId;
        if (transcriptChannelId) {
          const transcriptChannel = await interaction.guild.channels.fetch(transcriptChannelId).catch(() => null);
          if (transcriptChannel && transcriptChannel.isTextBased()) {
            await sendTranscript(interaction.channel, transcriptChannel);
          }
        }

        await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
        removeOpenTicket(guildId, ownerId);
        await interaction.channel.delete('Ticket closed');
        return;
      }

      if (customId.startsWith('sendembed_advanced:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId]?.embeds || Array.from({ length: 10 }, () => null);
        const currentEmbed = channelEmbeds[slot - 1] || {};

        const modal = new ModalBuilder()
          .setCustomId(`sendembed_advanced_modal:${slot}:${channelId}`)
          .setTitle(`Edit Advanced Options - Slot ${slot}`);

        const footerInput = new TextInputBuilder()
          .setCustomId('footer')
          .setLabel('Footer Text')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.footer || '')
          .setRequired(false);

        const footerIconInput = new TextInputBuilder()
          .setCustomId('footer_icon_url')
          .setLabel('Footer Icon URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.footer_icon_url || '')
          .setRequired(false);

        const authorNameInput = new TextInputBuilder()
          .setCustomId('author_name')
          .setLabel('Author Name')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.author_name || '')
          .setRequired(false);

        const authorIconInput = new TextInputBuilder()
          .setCustomId('author_icon_url')
          .setLabel('Author Icon URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.author_icon_url || '')
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(footerInput);
        const row2 = new ActionRowBuilder().addComponents(footerIconInput);
        const row3 = new ActionRowBuilder().addComponents(authorNameInput);
        const row4 = new ActionRowBuilder().addComponents(authorIconInput);

        modal.addComponents(row1, row2, row3, row4);
        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('sendembed_advanced_modal:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const footer = interaction.fields.getTextInputValue('footer');
        const footerIconUrl = interaction.fields.getTextInputValue('footer_icon_url');
        const authorName = interaction.fields.getTextInputValue('author_name');
        const authorIconUrl = interaction.fields.getTextInputValue('author_icon_url');

        const guildConfig = getGuildConfig(interaction.guild.id);
        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId] || { channelId, embeds: Array.from({ length: 10 }, () => null) };
        const updatedEmbeds = [...channelEmbeds.embeds];
        const slotIndex = slot - 1;
        const embedData = updatedEmbeds[slotIndex] || {};

        embedData.footer = footer || null;
        embedData.footer_icon_url = footerIconUrl || null;
        embedData.author_name = authorName || null;
        embedData.author_icon_url = authorIconUrl || null;

        updatedEmbeds[slotIndex] = embedData;
        channelEmbeds.embeds = updatedEmbeds;
        pendingEmbeds[channelId] = channelEmbeds;

        setGuildConfig(interaction.guild.id, { pendingEmbeds });

        const continueButton = new ButtonBuilder()
          .setCustomId(`sendembed_slot:${slot}:${channelId}`)
          .setLabel('Edit This Slot Again')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(continueButton);

        await interaction.reply({ content: `Advanced options for slot ${slot} saved!`, components: [row], ephemeral: true });
        return;
      }

      if (customId.startsWith('sendembed_preview:')) {
        const channelId = customId.split(':')[1];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId];

        if (!channelEmbeds || channelEmbeds.embeds.every((e) => !e)) {
          await interaction.reply({ content: 'No embeds to preview. Edit some embeds first.', ephemeral: true });
          return;
        }

        const embeds = channelEmbeds.embeds.filter((data) => hasEmbeddableContent(data)).map((data) => buildEmbedFromData(data));

        if (embeds.length > 0) {
          await interaction.reply({
            content: `**Preview** (${embeds.length} embed${embeds.length > 1 ? 's' : ''})`,
            embeds,
            ephemeral: true
          });
        } else {
          await interaction.reply({ content: 'No embeds with content to preview.', ephemeral: true });
        }
        return;
      }

      if (customId.startsWith('sendembed_send:')) {
        const channelId = customId.split(':')[1];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId];

        if (!channelEmbeds || channelEmbeds.embeds.every((e) => !e)) {
          await interaction.reply({ content: 'No embeds to send. Edit some embeds first.', ephemeral: true });
          return;
        }

        const targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.reply({ content: 'Cannot access the target channel.', ephemeral: true });
          return;
        }

        try {
          const embeds = channelEmbeds.embeds.filter((data) => hasEmbeddableContent(data)).map((data) => buildEmbedFromData(data));

          if (embeds.length > 0) {
            await targetChannel.send({ embeds });
            await interaction.reply({
              content: `✅ Sent ${embeds.length} embed(s) to ${targetChannel}!`,
              ephemeral: true
            });

            delete pendingEmbeds[channelId];
            setGuildConfig(interaction.guild.id, { pendingEmbeds });
          } else {
            await interaction.reply({ content: 'No embeds with content to send.', ephemeral: true });
          }
        } catch (error) {
          console.error('Embed send error:', error);
          await interaction.reply({ content: 'Failed to send embeds. Check my permissions.', ephemeral: true });
        }
        return;
      }

      if (customId.startsWith('sendembed_slot:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];

        if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
          await interaction.reply({ content: 'That slot is not available.', ephemeral: true });
          return;
        }

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId]?.embeds || Array.from({ length: 10 }, () => null);
        const currentEmbed = channelEmbeds[slot - 1] || {};

        const modal = new ModalBuilder()
          .setCustomId(`sendembed_modal:${slot}:${channelId}`)
          .setTitle(`Edit Embed Slot ${slot}`);

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.title || '')
          .setRequired(false);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentEmbed.description || '')
          .setRequired(false);

        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Color (hex, e.g. #00ff00)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.color || '')
          .setRequired(false);

        const imageUrlInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.image_url || '')
          .setRequired(false);

        const thumbnailUrlInput = new TextInputBuilder()
          .setCustomId('thumbnail_url')
          .setLabel('Thumbnail URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.thumbnail_url || '')
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(titleInput);
        const row2 = new ActionRowBuilder().addComponents(descriptionInput);
        const row3 = new ActionRowBuilder().addComponents(colorInput);
        const row4 = new ActionRowBuilder().addComponents(imageUrlInput);
        const row5 = new ActionRowBuilder().addComponents(thumbnailUrlInput);

        modal.addComponents(row1, row2, row3, row4, row5);
        await interaction.showModal(modal);
        return;
      }

      if (!customId.startsWith('buttonrole_toggle:')) return;

      const roleId = customId.split(':')[1];
      const config = getButtonRolesConfig(interaction.guild.id);
      const mapping = findButtonRole(config, roleId);
      if (!mapping) {
        await interaction.reply({ content: 'This role button is no longer configured.', ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: 'Unable to find your member data.', ephemeral: true });
        return;
      }

      const hasRole = member.roles.cache.has(roleId);
      try {
        if (hasRole) {
          await member.roles.remove(roleId);
          await interaction.reply({ content: `Removed role <@&${roleId}> from you.`, ephemeral: true });
        } else {
          await member.roles.add(roleId);
          await interaction.reply({ content: `Added role <@&${roleId}> to you.`, ephemeral: true });
        }
      } catch (error) {
        console.error('Button role assign error:', error);
        await interaction.reply({ content: 'I could not update your role. Check my permissions.', ephemeral: true });
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'command') {
        const restrictedCommands = Array.from(interaction.client.commands.values())
          .filter((command) => command.requiredPermissions && command.data?.name)
          .map((command) => command.data.name)
          .sort();

        const filtered = restrictedCommands
          .filter((name) => name.toLowerCase().includes(focused.value.toLowerCase()))
          .slice(0, 25)
          .map((name) => ({ name, value: name }));

        await interaction.respond(filtered);
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      if (customId.startsWith('editwelcome_modal:')) {
        const slot = Number(customId.split(':')[1]);
        if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
          await interaction.reply({ content: 'That welcome slot is not available.', ephemeral: true });
          return;
        }

        const color = interaction.fields.getTextInputValue('color');
        if (color) {
          const normalized = color.trim().replace(/^#/, '');
          if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
            await interaction.reply({ content: 'Please provide a valid hex color like #00ff00.', ephemeral: true });
            return;
          }
        }

        const imageUrlInput = interaction.fields.getTextInputValue('image_url');
        const thumbnailUrlInput = interaction.fields.getTextInputValue('thumbnail_url');
        const imageUrl = normalizeHttpUrl(imageUrlInput);
        const thumbnailUrl = normalizeHttpUrl(thumbnailUrlInput);
        if (imageUrlInput.trim() && !imageUrl) {
          await interaction.reply({ content: 'Please provide a valid Image URL starting with http:// or https://', ephemeral: true });
          return;
        }
        if (thumbnailUrlInput.trim() && !thumbnailUrl) {
          await interaction.reply({ content: 'Please provide a valid Thumbnail URL starting with http:// or https://', ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const welcomeEmbeds = Array.isArray(guildConfig.welcomeEmbeds) ? [...guildConfig.welcomeEmbeds] : Array.from({ length: 10 }, () => null);
        const slotIndex = slot - 1;
        const existingData = welcomeEmbeds[slotIndex] || {};
        const updatedData = {
          ...existingData,
          title: interaction.fields.getTextInputValue('title') || null,
          description: interaction.fields.getTextInputValue('description') || null,
          color: color || null,
          image_url: imageUrl,
          thumbnail_url: thumbnailUrl
        };

        const hasContent = Boolean(
          updatedData.title ||
            updatedData.description ||
            updatedData.image_url ||
            updatedData.thumbnail_url ||
            updatedData.author_name ||
            updatedData.footer
        );

        welcomeEmbeds[slotIndex] = hasContent ? updatedData : null;

        setGuildConfig(interaction.guild.id, { welcomeEmbeds });

        const advancedButton = new ButtonBuilder()
          .setCustomId(`editwelcome_advanced:${slot}`)
          .setLabel('Edit Advanced Options')
          .setStyle(ButtonStyle.Secondary);
        const editAgainButton = new ButtonBuilder()
          .setCustomId(`editwelcome_slot:${slot}`)
          .setLabel('Edit This Slot Again')
          .setStyle(ButtonStyle.Primary);

        await interaction.reply({
          content: `Saved welcome slot ${slot}. Edit advanced options or edit this slot again.`,
          components: [new ActionRowBuilder().addComponents(advancedButton, editAgainButton)],
          ephemeral: true
        });
        return;
      }

      if (customId.startsWith('editwelcome_advanced_modal:')) {
        const slot = Number(customId.split(':')[1]);
        if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
          await interaction.reply({ content: 'That welcome slot is not available.', ephemeral: true });
          return;
        }

        const iconUrlsInput = interaction.fields.getTextInputValue('icon_urls');
        const fieldsInput = interaction.fields.getTextInputValue('fields');
        let fields = [];

        let parsedIconUrls;
        try {
          parsedIconUrls = parseWelcomeIconUrlsInput(iconUrlsInput);
          fields = parseWelcomeFieldsInput(fieldsInput);
        } catch (error) {
          await interaction.reply({ content: error.message, ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const welcomeEmbeds = Array.isArray(guildConfig.welcomeEmbeds) ? [...guildConfig.welcomeEmbeds] : Array.from({ length: 10 }, () => null);
        const slotIndex = slot - 1;
        const existingData = welcomeEmbeds[slotIndex] || {};

        existingData.footer = interaction.fields.getTextInputValue('footer') || null;
        existingData.footer_icon_url = parsedIconUrls.footerIconUrl;
        existingData.author_name = interaction.fields.getTextInputValue('author_name') || null;
        existingData.author_icon_url = parsedIconUrls.authorIconUrl;
        existingData.fields = fields;

        welcomeEmbeds[slotIndex] = existingData;
        setGuildConfig(interaction.guild.id, { welcomeEmbeds });

        await interaction.reply({
          content: `Advanced options for welcome slot ${slot} saved!`,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`editwelcome_slot:${slot}`)
              .setLabel('Edit This Slot Again')
              .setStyle(ButtonStyle.Primary)
          )],
          ephemeral: true
        });
        return;
      }

      if (customId.startsWith('sendembed_modal:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const color = interaction.fields.getTextInputValue('color');
        const imageUrl = interaction.fields.getTextInputValue('image_url');
        const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail_url');

        const guildConfig = getGuildConfig(interaction.guild.id);

        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId] || { channelId, embeds: Array.from({ length: 10 }, () => null) };
        const updatedEmbeds = [...channelEmbeds.embeds];
        const slotIndex = slot - 1;

        const existingEmbedData = updatedEmbeds[slotIndex] || {};
        const embedData = {
          ...existingEmbedData,
          title: title || null,
          description: description || null,
          color: color || null,
          image_url: imageUrl || null,
          thumbnail_url: thumbnailUrl || null,
          fields: Array.isArray(existingEmbedData.fields) ? existingEmbedData.fields : []
        };

        updatedEmbeds[slotIndex] = hasEmbeddableContent(embedData) ? embedData : null;

        setGuildConfig(interaction.guild.id, {
          pendingEmbeds: {
            ...pendingEmbeds,
            [channelId]: {
              ...channelEmbeds,
              embeds: updatedEmbeds
            }
          }
        });

        const advancedButton = new ButtonBuilder()
          .setCustomId(`sendembed_advanced:${slot}:${channelId}`)
          .setLabel('Edit Advanced Options')
          .setStyle(ButtonStyle.Secondary);

        const editAgainButton = new ButtonBuilder()
          .setCustomId(`sendembed_slot:${slot}:${channelId}`)
          .setLabel('Edit This Slot Again')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(advancedButton, editAgainButton);

        await interaction.reply({
          content: `Saved slot ${slot}. Edit advanced options or edit this slot again.`,
          components: [row],
          ephemeral: true
        });
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const guildConfig = getGuildConfig(interaction.guild.id);
    const allowedMemberCommands = guildConfig.allowedCommands || [];
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    if (command.requiredPermissions) {
      const hasStaffPermissions = interaction.member.permissions.has(command.requiredPermissions);
      const commandName = command.data?.name || interaction.commandName;
      const deniedRoles = guildConfig.commandRoleDeny?.[commandName] || [];
      const hasDeniedRole = interaction.member.roles.cache.some((role) => deniedRoles.includes(role.id));
      if (!hasStaffPermissions && hasDeniedRole) {
        await interaction.reply({
          content: 'Your role is denied from using this restricted command.',
          ephemeral: true
        });
        return;
      }

      const memberAllowed = allowedMemberCommands.includes(commandName);
      if (!hasStaffPermissions && !memberAllowed) {
        await interaction.reply({
          content: 'This command is reserved for staff. Ask a staff member to allow it for members with /commandaccess.',
          ephemeral: true
        });
        return;
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (error?.code === 10062 || error?.code === 40060) {
        return;
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }
};
