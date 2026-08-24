import { getButtonRolesConfig, findButtonRole } from '../utils/buttonRoles.js';
import { setGuildConfig, getGuildConfig } from '../utils/settings.js';
import {
  getTicketConfig,
  setTicketConfig,
  addOpenTicket,
  removeOpenTicket,
  findTicketOwnerByChannel,
  publishTicketPanel
} from '../utils/tickets.js';

const ticketOpenLocks = new Map();
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

function hexToButtonStyle(hex) {
  if (!hex) return ButtonStyle.Primary;

  const cleanHex = hex.replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]{6}$/i.test(cleanHex)) return ButtonStyle.Primary;

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) {
    return ButtonStyle.Secondary;
  }

  if (r > g && r > b) {
    return ButtonStyle.Danger;
  }
  if (g > r && g > b) {
    return ButtonStyle.Success;
  }
  if (b > r && b > g) {
    return ButtonStyle.Primary;
  }

  return ButtonStyle.Primary;
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

function isLikelyTicketChannel(channel, ticketConfig = null) {
  if (!channel) return false;

  const name = (channel.name || '').toLowerCase();
  const topic = (channel.topic || '').toLowerCase();

  if (name.startsWith('ticket-') || topic.includes('ticket for')) return true;
  if (ticketConfig?.categoryId && channel.parentId === ticketConfig.categoryId) return true;
  if (name.includes('ticket')) return true;

  return false;
}

async function safeInteractionReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (error) {
    if (error?.code === 40060) {
      return await interaction.followUp(payload).catch(() => null);
    }
    throw error;
  }
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

function buildTicketSlotPickerComponents(selectedSlot = null, channelId = null) {
  const firstRow = [];
  for (let index = 1; index <= 5; index += 1) {
    let buttonId = `ticketedit_slot:${index}`;
    if (channelId) buttonId += `:${channelId}`;
    firstRow.push(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  const secondRow = [];
  for (let index = 6; index <= 10; index += 1) {
    let buttonId = `ticketedit_slot:${index}`;
    if (channelId) buttonId += `:${channelId}`;
    secondRow.push(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(`Slot ${index}`)
        .setStyle(selectedSlot === index ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  }

  let previewId = 'ticketedit_preview';
  let sendId = 'ticketedit_send';
  let clearId = 'ticketedit_clear';
  if (channelId) {
    previewId += `:${channelId}`;
    sendId += `:${channelId}`;
    clearId += `:${channelId}`;
  }

  const previewButton = new ButtonBuilder()
    .setCustomId(previewId)
    .setLabel('Preview Embeds')
    .setStyle(ButtonStyle.Secondary);

  const sendButton = new ButtonBuilder()
    .setCustomId(sendId)
    .setLabel('Send to Panel')
    .setStyle(ButtonStyle.Success);

  const clearButton = new ButtonBuilder()
    .setCustomId(clearId)
    .setLabel('Clear Embeds')
    .setStyle(ButtonStyle.Danger);

  const thirdRow = new ActionRowBuilder().addComponents(previewButton, sendButton, clearButton);

  return [new ActionRowBuilder().addComponents(...firstRow), new ActionRowBuilder().addComponents(...secondRow), thirdRow];
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
      console.log(`Button interaction received: ${customId} from ${interaction.user.tag} (${interaction.user.id})`);

      if (customId.startsWith('role_button:') || customId.startsWith('buttonrole_toggle:')) {
        const roleId = customId.split(':')[1];
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

        if (!role) {
          await interaction.reply({ content: 'That role no longer exists.', ephemeral: true });
          return;
        }

        try {
          if (!interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.add(roleId);
            await interaction.reply({ content: `✅ Added **${role.name}** role!`, ephemeral: true });
          } else {
            await interaction.member.roles.remove(roleId);
            await interaction.reply({ content: `❌ Removed **${role.name}** role!`, ephemeral: true });
          }
        } catch (error) {
          console.error(`Legacy role button ${roleId} failed:`, error);
          await interaction.reply({ content: 'I could not update that role. Check my permissions and role hierarchy.', ephemeral: true });
        }
        return;
      }

      if (customId.startsWith('editembed_select:')) {
        const parts = customId.split(':');
        const channelId = parts[1];
        const messageId = parts[2];
        const embedIndex = Number(parts[3]);

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        const targetEmbed = message.embeds[embedIndex];
        if (!targetEmbed) {
          await interaction.reply({ content: 'Embed not found.', ephemeral: true });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(`editembed_modal:${channelId}:${messageId}:${embedIndex}`)
          .setTitle(`Edit Embed ${embedIndex + 1}`);

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setValue(targetEmbed.title || '')
          .setRequired(false);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(targetEmbed.description || '')
          .setRequired(false);

        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Color (hex, e.g. #00ff00)')
          .setStyle(TextInputStyle.Short)
          .setValue((targetEmbed.color?.toString(16) || '').padStart(6, '0'))
          .setRequired(false);

        const imageUrlInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setValue(targetEmbed.image?.url || '')
          .setRequired(false);

        const thumbnailUrlInput = new TextInputBuilder()
          .setCustomId('thumbnail_url')
          .setLabel('Thumbnail URL')
          .setStyle(TextInputStyle.Short)
          .setValue(targetEmbed.thumbnail?.url || '')
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

      if (customId.startsWith('editembed_resend:')) {
        const parts = customId.split(':');
        const channelId = parts[1];
        const messageId = parts[2];

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        // Show modal to ask which channel to resend to
        const modal = new ModalBuilder()
          .setCustomId(`editembed_resend_modal:${channelId}:${messageId}`)
          .setTitle('Resend Message');

        const channelInput = new TextInputBuilder()
          .setCustomId('target_channel')
          .setLabel('Channel (name or ID)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., #announcements or 1234567890')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('editrolebutton_edit:')) {
        const parts = customId.split(':');
        
        // Validate we have the correct number of parts
        if (parts.length < 4) {
          console.error(`[editrolebutton_edit] Invalid custom ID format: ${customId}, parts: ${parts.length}`);
          await interaction.reply({ content: 'Invalid button data format.', ephemeral: true });
          return;
        }

        const channelId = parts[1];
        const messageId = parts[2];
        const buttonIndex = Number(parts[3]);

        console.log(`[editrolebutton_edit] Parsed - channelId: ${channelId}, messageId: ${messageId}, buttonIndex: ${buttonIndex}`);

        if (!channelId || !messageId || isNaN(buttonIndex)) {
          console.error(`[editrolebutton_edit] Invalid parsed values - channelId: ${channelId}, messageId: ${messageId}, buttonIndex: ${buttonIndex}`);
          await interaction.reply({ content: 'Invalid button data.', ephemeral: true });
          return;
        }

        const channel = await interaction.guild.channels.fetch(channelId).catch((err) => {
          console.error(`[editrolebutton_edit] Channel fetch failed for ${channelId}:`, err.message);
          return null;
        });
        if (!channel) {
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        const roleButtons = [];
        message.components?.forEach((row, rowIndex) => {
          row.components?.forEach((button, index) => {
            if (button.data?.custom_id?.startsWith('role_button:')) {
              roleButtons.push({ rowIndex, index, button });
            }
          });
        });

        const targetButton = roleButtons[buttonIndex];
        if (!targetButton) {
          await interaction.reply({ content: 'That button no longer exists.', ephemeral: true });
          return;
        }

        const currentRoleId = targetButton.button.data.custom_id.replace('role_button:', '');
        const modal = new ModalBuilder()
          .setCustomId(`editrolebutton_modal:${channelId}:${messageId}:${buttonIndex}`)
          .setTitle('Edit Role Button');

        const labelInput = new TextInputBuilder()
          .setCustomId('label')
          .setLabel('Button Label')
          .setStyle(TextInputStyle.Short)
          .setValue(targetButton.button.data.label || '')
          .setRequired(false);

        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Button Color (hex, optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('#FF0000')
          .setRequired(false);

        const roleInput = new TextInputBuilder()
          .setCustomId('role')
          .setLabel('Role ID or name')
          .setStyle(TextInputStyle.Short)
          .setValue(currentRoleId)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(labelInput),
          new ActionRowBuilder().addComponents(colorInput),
          new ActionRowBuilder().addComponents(roleInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('editrolebutton_remove:')) {
        const parts = customId.split(':');
        
        if (parts.length < 4) {
          console.error(`[editrolebutton_remove] Invalid custom ID format: ${customId}, parts: ${parts.length}`);
          await interaction.reply({ content: 'Invalid button data format.', ephemeral: true });
          return;
        }

        const channelId = parts[1];
        const messageId = parts[2];
        const buttonIndex = Number(parts[3]);

        console.log(`[editrolebutton_remove] Parsed - channelId: ${channelId}, messageId: ${messageId}, buttonIndex: ${buttonIndex}`);

        if (!channelId || !messageId || isNaN(buttonIndex)) {
          console.error(`[editrolebutton_remove] Invalid parsed values - channelId: ${channelId}, messageId: ${messageId}, buttonIndex: ${buttonIndex}`);
          await interaction.reply({ content: 'Invalid button data.', ephemeral: true });
          return;
        }

        const channel = await interaction.guild.channels.fetch(channelId).catch((err) => {
          console.error(`[editrolebutton_remove] Channel fetch failed for ${channelId}:`, err.message);
          return null;
        });
        if (!channel) {
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        const roleButtons = [];
        message.components?.forEach((row, rowIndex) => {
          row.components?.forEach((button, index) => {
            if (button.data?.custom_id?.startsWith('role_button:')) {
              roleButtons.push({ rowIndex, index, button });
            }
          });
        });

        const targetButton = roleButtons[buttonIndex];
        if (!targetButton) {
          await interaction.reply({ content: 'That button no longer exists.', ephemeral: true });
          return;
        }

        const updatedComponents = [];
        message.components?.forEach((row, rowIndex) => {
          const buttons = row.components?.filter((button, index) => {
            if (!button.data?.custom_id?.startsWith('role_button:')) return true;
            const isTargetButton = rowIndex === targetButton.rowIndex && index === targetButton.index;
            return !isTargetButton;
          }) || [];

          if (buttons.length > 0) {
            const rebuiltRow = new ActionRowBuilder().addComponents(...buttons);
            updatedComponents.push(rebuiltRow);
          }
        });

        await message.edit({ components: updatedComponents });
        await interaction.reply({ content: '✅ Removed that role button from the message.', ephemeral: true });
        return;
      }

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

      if (customId.startsWith('ticket_embed_')) {
        const slotIndex = parseInt(customId.split('_')[2]);
        const guildId = interaction.guild.id;
        const ticketConfig = getTicketConfig(guildId);
        
        if (!ticketConfig.panelEmbeds || !ticketConfig.panelEmbeds[slotIndex]) {
          await interaction.reply({ content: 'This embed slot is not configured.', ephemeral: true });
          return;
        }

        const embedConfig = ticketConfig.panelEmbeds[slotIndex];
        const embed = new EmbedBuilder()
          .setTitle(embedConfig.title || 'Untitled')
          .setDescription(embedConfig.description || '')
          .setColor(embedConfig.color ?? 0x5865f2);

        if (embedConfig.footer) {
          embed.setFooter({ text: embedConfig.footer });
        }

        if (embedConfig.image_url) {
          embed.setImage(embedConfig.image_url);
        }

        if (embedConfig.fields && Array.isArray(embedConfig.fields)) {
          for (const field of embedConfig.fields) {
            if (field.name && field.value) {
              embed.addFields({ name: field.name, value: field.value, inline: !!field.inline });
            }
          }
        }

        await interaction.reply({ content: `Embed - Slot ${slotIndex + 1}`, embeds: [embed], ephemeral: true });
        return;
      }

      if (customId.startsWith('ticketedit_slot:')) {
        const parts = customId.split(':');
        const slot = parseInt(parts[1]);
        const channelId = parts[2];

        const modal = new ModalBuilder()
          .setCustomId(`ticketedit_modal:${slot}:${channelId}`)
          .setTitle(`Edit Ticket Embed - Slot ${slot}`);

        const guildId = interaction.guild.id;
        const config = getTicketConfig(guildId);
        const panelEmbeds = config.panelEmbeds || Array(10).fill(null);
        const currentEmbed = panelEmbeds[slot - 1] || {};

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
          .setLabel('Color (hex, e.g. #5865f2)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.color ? currentEmbed.color.toString(16).padStart(6, '0') : '')
          .setRequired(false);

        const imageUrlInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setValue(currentEmbed.image_url || '')
          .setRequired(false);

        const fieldsInput = new TextInputBuilder()
          .setCustomId('fields')
          .setLabel('Fields (name|value|inline - one per line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(
            currentEmbed.fields
              ?.map((f) => `${f.name}|${f.value}|${f.inline ? 'inline' : 'block'}`)
              .join('\n') || ''
          )
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(titleInput);
        const row2 = new ActionRowBuilder().addComponents(descriptionInput);
        const row3 = new ActionRowBuilder().addComponents(colorInput);
        const row4 = new ActionRowBuilder().addComponents(imageUrlInput);
        const row5 = new ActionRowBuilder().addComponents(fieldsInput);

        modal.addComponents(row1, row2, row3, row4, row5);
        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('ticketedit_preview:')) {
        const channelId = customId.split(':')[1];
        const guildId = interaction.guild.id;
        const config = getTicketConfig(guildId);
        const panelEmbeds = config.panelEmbeds || [];

        const embeds = panelEmbeds
          .filter((embed) => embed && (embed.title || embed.description || embed.image_url))
          .map((embed) => {
            const e = new EmbedBuilder();
            if (embed.title) e.setTitle(embed.title);
            if (embed.description) e.setDescription(embed.description);
            if (embed.color) e.setColor(embed.color);
            if (embed.footer) e.setFooter({ text: embed.footer });
            if (embed.image_url) e.setImage(embed.image_url);
            if (embed.fields) {
              embed.fields.forEach((f) => {
                if (f.name && f.value) e.addFields({ name: f.name, value: f.value, inline: !!f.inline });
              });
            }
            return e;
          });

        if (embeds.length === 0) {
          await interaction.reply({ content: 'No embeds with content to preview.', ephemeral: true });
        } else {
          await interaction.reply({
            content: `Previewing ${embeds.length} embed(s):`,
            embeds,
            ephemeral: true
          });
        }
        return;
      }

      if (customId.startsWith('ticketedit_send:')) {
        const channelId = customId.split(':')[1];
        const guildId = interaction.guild.id;
        const config = getTicketConfig(guildId);
        console.log(`ticketedit_send received for channel ${channelId} guild ${guildId}`);
        const deferred = await interaction.deferReply({ ephemeral: true }).catch((error) => {
          console.error('ticketedit_send deferReply failed:', error);
          return null;
        });

        if (!channelId) {
          if (deferred) {
            await interaction.editReply({ content: 'Channel ID not found.' });
          } else {
            await interaction.reply({ content: 'Channel ID not found.', ephemeral: true });
          }
          return;
        }

        let channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
          channel = await interaction.guild.channels.fetch(channelId).catch((error) => {
            console.error('Failed to fetch panel channel:', error);
            return null;
          });
        }
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: 'The selected panel channel is no longer available or is not text-based.', ephemeral: true });
          return;
        }

        const botMember = interaction.guild.members.me || (await interaction.guild.members.fetch(interaction.client.user.id).catch((error) => {
          console.error('Failed to fetch bot member:', error);
          return null;
        }));
        const perms = channel.permissionsFor(botMember || interaction.client.user);
        const requiredPerms = [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks
        ];
        const permNames = {
          [PermissionFlagsBits.ViewChannel]: 'ViewChannel',
          [PermissionFlagsBits.SendMessages]: 'SendMessages',
          [PermissionFlagsBits.EmbedLinks]: 'EmbedLinks'
        };

        console.log('ticketedit_send permissions', {
          channelId,
          channelType: channel.type,
          botMemberId: botMember?.id,
          botHasPerms: perms?.has(requiredPerms),
          viewChannel: perms?.has(PermissionFlagsBits.ViewChannel),
          sendMessages: perms?.has(PermissionFlagsBits.SendMessages),
          embedLinks: perms?.has(PermissionFlagsBits.EmbedLinks)
        });

        if (!perms || !perms.has(requiredPerms)) {
          const missing = requiredPerms.filter((perm) => !perms?.has(perm));
          const missingNames = missing.map((perm) => permNames[perm] || String(perm)).join(', ');
          if (deferred) {
            await interaction.editReply({ content: `I need permission to use the selected panel channel. Missing: ${missingNames}.` });
          } else {
            await interaction.reply({
              content: `I need permission to use the selected panel channel. Missing: ${missingNames}.`,
              ephemeral: true
            });
          }
          return;
        }

        setTicketConfig(guildId, { panelChannelId: channelId });

        try {
          const messageId = await publishTicketPanel(channel, config);
          if (messageId) {
            setTicketConfig(guildId, { messageId });
          }
          if (deferred) {
            await interaction.editReply({
              content: `✅ Ticket panel sent to ${channel}!`
            });
          } else {
            await interaction.reply({
              content: `✅ Ticket panel sent to ${channel}!`,
              ephemeral: true
            });
          }
          console.log(`Ticket panel published in channel ${channel.id} with messageId ${messageId}`);
        } catch (error) {
          console.error('Ticket panel send error:', error);
          const message = error?.message || error?.name || String(error);
          if (deferred) {
            await interaction.editReply({ content: `Failed to send ticket panel: ${message}` });
          } else {
            await interaction.reply({
              content: `Failed to send ticket panel: ${message}`,
              ephemeral: true
            });
          }
        }
        return;
      }

      if (customId.startsWith('ticketedit_clear:')) {
        const channelId = customId.split(':')[1];
        const guildId = interaction.guild.id;
        const config = getTicketConfig(guildId);
        const deferred = await interaction.deferReply({ ephemeral: true }).catch((error) => {
          console.error('ticketedit_clear deferReply failed:', error);
          return null;
        });

        if (!channelId) {
          if (deferred) {
            await interaction.editReply({ content: 'Channel ID not found.' });
          } else {
            await interaction.reply({ content: 'Channel ID not found.', ephemeral: true });
          }
          return;
        }

        let channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
          channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        }
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: 'The selected panel channel is no longer available or is not text-based.', ephemeral: true });
          return;
        }

        const emptyEmbeds = [];
        setTicketConfig(guildId, { panelEmbeds: emptyEmbeds });

        try {
          const messageId = await publishTicketPanel(channel, { ...config, panelEmbeds: emptyEmbeds });
          if (messageId) {
            setTicketConfig(guildId, { messageId });
          }
          if (deferred) {
            await interaction.editReply({ content: '✅ All ticket panel embeds have been cleared.' });
          } else {
            await interaction.reply({ content: '✅ All ticket panel embeds have been cleared.', ephemeral: true });
          }
        } catch (error) {
          console.error('Ticket panel clear error:', error);
          if (deferred) {
            await interaction.editReply({ content: 'Failed to clear ticket panel embeds.' });
          } else {
            await interaction.reply({ content: 'Failed to clear ticket panel embeds.', ephemeral: true });
          }
        }
        return;
      }

      if (customId === 'ticket_open' || customId.startsWith('ticket_open:')) {
        const guildId = interaction.guild.id;
        const ticketConfig = getTicketConfig(guildId);

        const activeMessageId = customId.startsWith('ticket_open:') ? customId.split(':')[1] : null;
        const isPendingButton = activeMessageId === 'pending';

        if (activeMessageId && !isPendingButton && ticketConfig.messageId && interaction.message?.id && interaction.message.id !== ticketConfig.messageId) {
          await interaction.reply({ content: 'This ticket panel is no longer active.', ephemeral: true }).catch(() => null);
          return;
        }

        if (activeMessageId && !isPendingButton && ticketConfig.messageId && activeMessageId !== String(ticketConfig.messageId)) {
          await interaction.reply({ content: 'This ticket panel is no longer active.', ephemeral: true }).catch(() => null);
          return;
        }

        if (!activeMessageId && ticketConfig.messageId && interaction.message?.id && interaction.message.id !== ticketConfig.messageId) {
          await interaction.reply({ content: 'This ticket panel is no longer active.', ephemeral: true }).catch(() => null);
          return;
        }

        const lockKey = `${interaction.guild.id}:${interaction.user.id}`;
        if (ticketOpenLocks.has(lockKey)) {
          await interaction.reply({ content: 'Ticket creation is already in progress. Please wait a moment.', ephemeral: true });
          return;
        }
        ticketOpenLocks.set(lockKey, true);
        console.log(`ticket_open start for ${interaction.user.id} in ${interaction.guild.id}`);
        const deferred = await interaction.deferReply({ ephemeral: true }).catch((error) => {
          console.error('ticket_open deferReply failed:', error);
          return null;
        });
        console.log('ticket_open deferred', !!deferred);

        try {
          const existingChannelId = ticketConfig.openTickets?.[interaction.user.id];

          if (existingChannelId) {
            const existingChannel = await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
            if (existingChannel) {
              if (deferred) {
                await interaction.editReply({ content: `You already have an open ticket: ${existingChannel}` });
              } else {
                await interaction.reply({ content: `You already have an open ticket: ${existingChannel}`, ephemeral: true });
              }
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

          const editButton = new ButtonBuilder()
            .setCustomId('ticket_edit')
            .setLabel('Edit Ticket')
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder().addComponents(closeButton, editButton);
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
          if (deferred) {
            await interaction.editReply({ content: `Your ticket has been opened: ${ticketChannel}` });
          } else {
            await interaction.reply({ content: `Your ticket has been opened: ${ticketChannel}`, ephemeral: true });
          }
          return;
        } catch (error) {
          console.error('ticket_open error:', error);
          if (deferred) {
            await interaction.editReply({ content: 'Failed to open ticket. Please try again or contact staff.' });
          } else {
            await interaction.reply({ content: 'Failed to open ticket. Please try again or contact staff.', ephemeral: true });
          }
          return;
        } finally {
          ticketOpenLocks.delete(lockKey);
        }
      }

      if (customId === 'ticket_close') {
        const guildId = interaction.guild.id;
        const ownerId = findTicketOwnerByChannel(guildId, interaction.channel.id);

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const ticketConfig = getTicketConfig(guildId);
        const isOwner = ownerId && interaction.user.id === ownerId;
        const isStaff = Boolean(ticketConfig.staffRoleId && member?.roles?.cache?.has(ticketConfig.staffRoleId));
        const canManage = Boolean(interaction.member.permissions.has(PermissionFlagsBits.ManageChannels));
        const isTicketChannel = isLikelyTicketChannel(interaction.channel, ticketConfig);

        if (!ownerId && !isTicketChannel) {
          await safeInteractionReply(interaction, { content: 'This button can only be used inside an active ticket channel.', ephemeral: true });
          return;
        }

        if (!isOwner && !isStaff && !canManage) {
          await safeInteractionReply(interaction, { content: 'You are not allowed to close this ticket.', ephemeral: true });
          return;
        }

        const transcriptChannelId = ticketConfig.transcriptChannelId;
        if (transcriptChannelId) {
          const transcriptChannel = await interaction.guild.channels.fetch(transcriptChannelId).catch(() => null);
          if (transcriptChannel && transcriptChannel.isTextBased()) {
            await sendTranscript(interaction.channel, transcriptChannel);
          }
        }

        await safeInteractionReply(interaction, { content: 'Closing ticket...', ephemeral: true });
        if (ownerId) {
          removeOpenTicket(guildId, ownerId);
        }
        await interaction.channel.delete('Ticket closed');
        return;
      }

      if (customId === 'ticket_edit') {
        const guildId = interaction.guild.id;
        const ownerId = findTicketOwnerByChannel(guildId, interaction.channel.id);

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const ticketConfig = getTicketConfig(guildId);
        const isOwner = ownerId && interaction.user.id === ownerId;
        const isStaff = Boolean(ticketConfig.staffRoleId && member?.roles?.cache?.has(ticketConfig.staffRoleId));
        const canManage = Boolean(interaction.member.permissions.has(PermissionFlagsBits.ManageChannels));
        const isTicketChannel = isLikelyTicketChannel(interaction.channel, ticketConfig);

        if (!ownerId && !isTicketChannel) {
          await safeInteractionReply(interaction, { content: 'This button can only be used inside an active ticket channel.', ephemeral: true });
          return;
        }

        if (!isOwner && !isStaff && !canManage) {
          await safeInteractionReply(interaction, { content: 'You are not allowed to edit this ticket.', ephemeral: true });
          return;
        }

        // Find the ticket message that contains the close button in this channel
        const fetched = await interaction.channel.messages.fetch({ limit: 50 }).catch(() => null);
        const ticketMessage = fetched?.find((m) => m.author?.bot && m.components?.some((r) => r.components?.some((c) => c.customId === 'ticket_close')) ) || null;
        if (!ticketMessage) {
          await safeInteractionReply(interaction, { content: 'Could not find the ticket message to edit.', ephemeral: true });
          return;
        }

        const existingEmbed = ticketMessage.embeds?.[0];
        const modal = new ModalBuilder().setCustomId(`ticket_edit_modal:${ticketMessage.id}`).setTitle('Edit Ticket Message');

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setValue(existingEmbed?.title || '')
          .setRequired(false);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(existingEmbed?.description || '')
          .setRequired(false);

        const footerInput = new TextInputBuilder()
          .setCustomId('footer')
          .setLabel('Footer')
          .setStyle(TextInputStyle.Short)
          .setValue(existingEmbed?.footer?.text || '')
          .setRequired(false);

        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Color (hex like #00ff00)')
          .setStyle(TextInputStyle.Short)
          .setValue(existingEmbed?.color ? `#${existingEmbed.color.toString(16).padStart(6, '0')}` : '')
          .setRequired(false);

        const imageInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setValue(existingEmbed?.image?.url || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descriptionInput),
          new ActionRowBuilder().addComponents(footerInput),
          new ActionRowBuilder().addComponents(colorInput),
          new ActionRowBuilder().addComponents(imageInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('sendembed_advanced:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];
        const messageId = parts[3];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /sendembed again.', ephemeral: true });
          return;
        }

        const guildConfig = getGuildConfig(interaction.guild.id);
        const pendingEmbeds = guildConfig.pendingEmbeds || {};
        const channelEmbeds = pendingEmbeds[channelId]?.embeds || Array.from({ length: 10 }, () => null);
        const currentEmbed = channelEmbeds[slot - 1] || {};

        let modalCustomId = `sendembed_advanced_modal:${slot}:${channelId}`;
        if (messageId) modalCustomId += `:${messageId}`;

        const modal = new ModalBuilder()
          .setCustomId(modalCustomId)
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
        const messageId = parts[3];

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

        let continueButtonId = `sendembed_slot:${slot}:${channelId}`;
        if (messageId) continueButtonId += `:${messageId}`;

        const continueButton = new ButtonBuilder()
          .setCustomId(continueButtonId)
          .setLabel('Edit This Slot Again')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(continueButton);

        await interaction.reply({ content: `Advanced options for slot ${slot} saved!`, components: [row], ephemeral: true });
        return;
      }

      if (customId.startsWith('sendembed_preview:')) {
        const parts = customId.split(':');
        const channelId = parts[1];
        const messageId = parts[2];

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
        const parts = customId.split(':');
        const channelId = parts[1];
        const messageId = parts[2];

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
            if (messageId) {
              // Update existing message
              const targetMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
              if (!targetMessage) {
                await interaction.reply({ content: 'Could not find the target message to update.', ephemeral: true });
                return;
              }
              await targetMessage.edit({ embeds });
              await interaction.reply({
                content: `✅ Updated [that message](${targetMessage.url}) with ${embeds.length} embed(s)!`,
                ephemeral: true,
                allowedMentions: { parse: [] }
              });
            } else {
              // Send new message
              await targetChannel.send({ embeds });
              await interaction.reply({
                content: `✅ Sent ${embeds.length} embed(s) to ${targetChannel}!`,
                ephemeral: true
              });
            }

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
        const messageId = parts[3];

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

        let modalCustomId = `sendembed_modal:${slot}:${channelId}`;
        if (messageId) modalCustomId += `:${messageId}`;

        const modal = new ModalBuilder()
          .setCustomId(modalCustomId)
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

      if (!customId.startsWith('buttonrole_toggle:')) {
        await safeInteractionReply(interaction, {
          content: 'This button is no longer available. Please use the latest panel.',
          ephemeral: true
        });
        return;
      }

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

      if (customId.startsWith('editrolebutton_modal:')) {
        const parts = customId.split(':');
        
        console.log(`[editrolebutton_modal] Full customId: "${customId}"`);
        console.log(`[editrolebutton_modal] Split parts:`, parts);
        console.log(`[editrolebutton_modal] Parts count: ${parts.length}`);
        
        const channelId = parts[1];
        const messageId = parts[2];
        const buttonIndex = Number(parts[3]);

        console.log(`[editrolebutton_modal] Parsed - channelId: "${channelId}", messageId: "${messageId}", buttonIndex: ${buttonIndex}`);
        console.log(`[editrolebutton_modal] channelId type: ${typeof channelId}, length: ${channelId?.length}`);
        console.log(`[editrolebutton_modal] Guild channels available: ${interaction.guild.channels.cache.size}`);

        const channel = await interaction.guild.channels.fetch(channelId).catch((err) => {
          console.error(`[editrolebutton_modal] Channel fetch failed for "${channelId}":`, err.message);
          return null;
        });
        if (!channel) {
          console.error(`[editrolebutton_modal] Channel is null after fetch`);
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        const roleButtons = [];
        message.components?.forEach((row, rowIndex) => {
          row.components?.forEach((button, index) => {
            if (button.data?.custom_id?.startsWith('role_button:')) {
              roleButtons.push({ rowIndex, index, button });
            }
          });
        });

        const targetButton = roleButtons[buttonIndex];
        if (!targetButton) {
          await interaction.reply({ content: 'That button no longer exists.', ephemeral: true });
          return;
        }

        const label = interaction.fields.getTextInputValue('label').trim();
        const colorHex = interaction.fields.getTextInputValue('color').trim();
        const roleInput = interaction.fields.getTextInputValue('role').trim();

        console.log(`[editrolebutton_modal] Color input value: "${colorHex}" (length: ${colorHex.length})`);

        let role = null;
        if (roleInput) {
          const roleMentionMatch = roleInput.match(/<@&(\d+)>/);
          const roleIdMatch = roleInput.match(/(\d+)/);
          if (roleMentionMatch) {
            role = await interaction.guild.roles.fetch(roleMentionMatch[1]).catch(() => null);
          } else if (roleIdMatch) {
            role = await interaction.guild.roles.fetch(roleIdMatch[1]).catch(() => null);
          } else {
            role = interaction.guild.roles.cache.find((candidate) => candidate.name.toLowerCase() === roleInput.toLowerCase());
          }
        }

        if (!role) {
          await interaction.reply({ content: 'I could not find that role. Please use a role ID, mention, or exact role name.', ephemeral: true });
          return;
        }

        const buttonStyle = colorHex ? hexToButtonStyle(colorHex) : (targetButton.button.data.style ?? ButtonStyle.Primary);
        console.log(`[editrolebutton_modal] Color hex: "${colorHex}" -> Button style: ${buttonStyle} (current style was: ${targetButton.button.data.style})`);

        const updatedButton = new ButtonBuilder()
          .setCustomId(`role_button:${role.id}`)
          .setLabel(label || targetButton.button.data.label || role.name)
          .setStyle(buttonStyle);

        const updatedComponents = [];
        message.components?.forEach((row, rowIndex) => {
          if (rowIndex === targetButton.rowIndex) {
            const rebuiltButtons = row.components?.map((button, index) => {
              if (index === targetButton.index) {
                return updatedButton;
              }
              return button;
            }) || [];
            const rebuiltRow = new ActionRowBuilder().addComponents(...rebuiltButtons);
            updatedComponents.push(rebuiltRow);
          } else {
            updatedComponents.push(row);
          }
        });

        await message.edit({ components: updatedComponents });
        await interaction.reply({ content: `✅ Updated the button for <@&${role.id}>.`, ephemeral: true });
        return;
      }

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

      if (customId.startsWith('ticketedit_modal:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];

        if (!channelId) {
          await interaction.reply({ content: 'Channel data lost. Please run /ticket editembeds again.', ephemeral: true });
          return;
        }

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const colorStr = interaction.fields.getTextInputValue('color');
        const imageUrl = interaction.fields.getTextInputValue('image_url');
        const fieldsStr = interaction.fields.getTextInputValue('fields');

        const color = colorStr ? parseInt(`0x${colorStr.replace(/^#/, '')}`) : undefined;

        const fields = [];
        if (fieldsStr.trim()) {
          const lines = fieldsStr.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            const [name, value, inlineStr] = line.split('|').map((s) => s.trim());
            if (name && value) {
              fields.push({ name, value, inline: inlineStr === 'inline' });
            }
          }
        }

        const guildId = interaction.guild.id;
        const config = getTicketConfig(guildId);
        const panelEmbeds = [...(config.panelEmbeds || Array(10).fill(null))];
        panelEmbeds[slot - 1] = {
          title,
          description,
          color,
          image_url: imageUrl || null,
          fields: fields.length ? fields : undefined
        };
        const updatedConfig = setTicketConfig(guildId, { panelEmbeds });

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const messageId = await publishTicketPanel(channel, updatedConfig);
          if (messageId) {
            setTicketConfig(guildId, { messageId, panelChannelId: channelId });
          }
        }

        await interaction.reply({
          content: `✅ Slot ${slot} embed updated and ticket panel refreshed! Click a slot below to edit more, Preview to see all embeds, or Send to Panel again if needed.`,
          components: buildTicketSlotPickerComponents(slot, channelId),
          ephemeral: true
        });
        return;
      }

      if (customId.startsWith('ticket_edit_modal:')) {
        const parts = customId.split(':');
        const messageId = parts[1];

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const footer = interaction.fields.getTextInputValue('footer');
        const colorStr = interaction.fields.getTextInputValue('color');
        const imageUrl = interaction.fields.getTextInputValue('image_url');
        const fieldsStr = interaction.fields.getTextInputValue('fields');

        if (colorStr) {
          const normalized = colorStr.trim().replace(/^#/, '');
          if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
            await interaction.reply({ content: 'Please provide a valid hex color like #00ff00.', ephemeral: true });
            return;
          }
        }

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: 'Channel context lost.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Original ticket message not found.', ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder();
        if (title) embed.setTitle(title);
        else if (message.embeds[0]?.title) embed.setTitle(message.embeds[0].title);
        if (description) embed.setDescription(description);
        else if (message.embeds[0]?.description) embed.setDescription(message.embeds[0].description);
        if (footer) embed.setFooter({ text: footer });
        else if (message.embeds[0]?.footer) embed.setFooter({ text: message.embeds[0].footer?.text || undefined });
        if (colorStr) embed.setColor(parseInt(`0x${colorStr.replace(/^#/, '')}`));
        else if (message.embeds[0]?.color) embed.setColor(message.embeds[0].color);
        if (imageUrl) embed.setImage(imageUrl);
        else if (message.embeds[0]?.image) embed.setImage(message.embeds[0].image.url);

        const fields = [];
        if (fieldsStr.trim()) {
          const lines = fieldsStr.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            const [name, value, inlineStr] = line.split('|').map((s) => s.trim());
            if (name && value) {
              fields.push({ name, value, inline: inlineStr === 'inline' });
            }
          }
        } else if (message.embeds[0]?.fields) {
          for (const f of message.embeds[0].fields) {
            fields.push({ name: f.name, value: f.value, inline: !!f.inline });
          }
        }

        if (fields.length) embed.addFields(...fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })));

        try {
          await message.edit({ embeds: [embed], components: message.components });
          await interaction.reply({ content: '✅ Ticket message updated.', ephemeral: true });
        } catch (error) {
          console.error('Ticket edit error:', error);
          await interaction.reply({ content: 'Failed to update ticket message. Check my permissions.', ephemeral: true });
        }

        return;
      }

      if (customId.startsWith('sendembed_modal:')) {
        const parts = customId.split(':');
        const slot = Number(parts[1]);
        const channelId = parts[2];
        const messageId = parts[3];

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

        let advancedButtonId = `sendembed_advanced:${slot}:${channelId}`;
        let editAgainButtonId = `sendembed_slot:${slot}:${channelId}`;
        if (messageId) {
          advancedButtonId += `:${messageId}`;
          editAgainButtonId += `:${messageId}`;
        }

        const advancedButton = new ButtonBuilder()
          .setCustomId(advancedButtonId)
          .setLabel('Edit Advanced Options')
          .setStyle(ButtonStyle.Secondary);

        const editAgainButton = new ButtonBuilder()
          .setCustomId(editAgainButtonId)
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

      if (customId.startsWith('editembed_modal:')) {
        const parts = customId.split(':');
        const channelId = parts[1];
        const messageId = parts[2];
        const embedIndex = Number(parts[3]) || 0;

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        const existingEmbed = message.embeds[embedIndex];
        if (!existingEmbed) {
          await interaction.reply({ content: 'That embed was not found.', ephemeral: true });
          return;
        }

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const color = interaction.fields.getTextInputValue('color');
        const imageUrl = interaction.fields.getTextInputValue('image_url');
        const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail_url');

        if (color) {
          const normalized = color.trim().replace(/^#/, '');
          if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
            await interaction.reply({ content: 'Please provide a valid hex color like #00ff00.', ephemeral: true });
            return;
          }
        }

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

        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        if (color) {
          const parsed = parseInt(color.replace(/^#/, ''), 16);
          embed.setColor(parsed);
        }
        if (imageUrl) embed.setImage(imageUrl);
        if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

        // Update the specific embed in the embeds array
        const embeds = [...message.embeds];
        embeds[embedIndex] = embed;

        await message.edit({ embeds });
        await interaction.reply({ content: 'Embed updated successfully.', ephemeral: true });
        return;
      }

      if (customId.startsWith('editembed_resend_modal:')) {
        const parts = customId.split(':');
        const channelId = parts[1];
        const messageId = parts[2];

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          await interaction.reply({ content: 'Channel not found.', ephemeral: true });
          return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
          await interaction.reply({ content: 'Message not found.', ephemeral: true });
          return;
        }

        const targetChannelInput = interaction.fields.getTextInputValue('target_channel');
        let targetChannel = null;

        // Try to find channel by ID or mention
        try {
          if (/^\d+$/.test(targetChannelInput)) {
            targetChannel = await interaction.guild.channels.fetch(targetChannelInput).catch(() => null);
          } else {
            // Try by name (with or without #)
            const channelName = targetChannelInput.replace(/^#/, '');
            targetChannel = interaction.guild.channels.cache.find(
              (ch) => ch.name === channelName && ch.isTextBased()
            );
          }
        } catch (error) {
          console.error('Error finding channel:', error);
        }

        if (!targetChannel) {
          await interaction.reply({ content: `Could not find channel: \`${targetChannelInput}\`. Try using the channel ID or exact name.`, ephemeral: true });
          return;
        }

        if (!targetChannel.isTextBased()) {
          await interaction.reply({ content: 'Target channel must be a text channel.', ephemeral: true });
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

          await targetChannel.send({ embeds });
          await interaction.reply({
            content: `✅ Resent ${message.embeds.length} embed${message.embeds.length === 1 ? '' : 's'} to ${targetChannel}`,
            ephemeral: true
          });
        } catch (error) {
          console.error('Error resending embeds:', error);
          await interaction.reply({ content: 'Failed to resend embeds. Check my permissions in that channel.', ephemeral: true });
        }
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    console.log(`Chat input command received: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id})`);
    const guildConfig = getGuildConfig(interaction.guild.id);
    const allowedMemberCommands = guildConfig.allowedCommands || [];
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command loaded for interaction: ${interaction.commandName}`);
      await interaction.reply({
        content: 'That command is not currently available. Please try again later or restart the bot.',
        ephemeral: true
      }).catch((error) => console.error('Failed to reply to missing command interaction:', error));
      return;
    }

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

    // Catch-all for any unhandled interaction types that need acknowledgement
    if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
      console.warn(`Unhandled interaction type: isButton=${interaction.isButton?.()}, isChatInputCommand=${interaction.isChatInputCommand?.()}, isModalSubmit=${interaction.isModalSubmit?.()}, isAutocomplete=${interaction.isAutocomplete?.()}, customId=${interaction.customId}, commandName=${interaction.commandName}`);
      await interaction.reply({
        content: 'This interaction is not currently supported.',
        ephemeral: true
      }).catch(() => null);
    }
  }
};
