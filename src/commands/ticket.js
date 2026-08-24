import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder
} from 'discord.js';
import { getTicketConfig, setTicketConfig, addOpenTicket, removeOpenTicket, findTicketOwnerByChannel, publishTicketPanel } from '../utils/tickets.js';

function parseHexColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }
  return Number(`0x${normalized}`);
}

function buildEmbedFromData(data) {
  const embed = new EmbedBuilder();

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (data.color) embed.setColor(data.color);
  if (data.footer) embed.setFooter({ text: data.footer });

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
  return Boolean(data?.title || data?.description || (Array.isArray(data?.fields) && data.fields.some((field) => field?.name && field?.value)));
}

function buildSlotPickerComponents(selectedSlot = null, channelId = null) {
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

function buildTicketChannelEmbed(config) {
  const embed = new EmbedBuilder()
    .setTitle(config.ticketTitle || 'Ticket Opened')
    .setDescription(
      config.ticketDescription ||
        'A staff member will be with you shortly. Press the button below to close this ticket when your issue is resolved.'
    )
    .setColor(config.ticketColor ?? 0x00ff00)
    .setFooter({ text: config.ticketFooter || 'Thank you for contacting support.' });

  if (config.ticketFields?.length) {
    for (const field of config.ticketFields) {
      if (!field.name || !field.value) continue;
      embed.addFields({ name: field.name, value: field.value, inline: !!field.inline });
    }
  }

  return embed;
}

function buildTicketChannelName(user) {
  const baseName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'ticket';
  return `ticket-${baseName}-${user.id.slice(-4)}`;
}

async function clearTicketPanelsInChannel(channel) {
  if (!channel || !channel.isTextBased()) return 0;

  let deleted = 0;
  let lastMessageId = null;
  let page = 0;

  while (page < 20) {
    const options = { limit: 100 };
    if (lastMessageId) options.before = lastMessageId;

    const fetched = await channel.messages.fetch(options).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    for (const msg of fetched.values()) {
      if (!msg.author?.bot) continue;

      await msg.delete().catch(() => null);
      deleted += 1;
    }

    if (fetched.size < 100) break;
    lastMessageId = fetched.last().id;
    page += 1;
  }

  return deleted;
}

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Configure ticket panel and ticket creation for the server')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setpanel')
        .setDescription('Set the channel where ticket panel messages are posted')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel for the ticket panel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setcategory')
        .setDescription('Set the category where ticket channels should be created')
        .addChannelOption((option) =>
          option
            .setName('category')
            .setDescription('The category for ticket channels')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setstaff')
        .setDescription('Set the staff role that can view and manage tickets')
        .addRoleOption((option) =>
          option.setName('role').setDescription('Staff role for ticket access').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('settranscript')
        .setDescription('Set the channel where ticket transcripts are sent')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to send ticket transcripts to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('editembeds')
        .setDescription('Edit ticket panel embeds (1-10 slots)')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel where the ticket panel will be displayed')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('editpanel')
        .setDescription('Edit the ticket open button settings')
        .addStringOption((option) =>
          option.setName('button_label').setDescription('Ticket button label').setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('button_style')
            .setDescription('Panel button color style')
            .addChoices(
              { name: 'Primary', value: 'Primary' },
              { name: 'Secondary', value: 'Secondary' },
              { name: 'Success', value: 'Success' },
              { name: 'Danger', value: 'Danger' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('editticket')
        .setDescription('Edit the ticket message sent when a ticket is opened')
        .addStringOption((option) =>
          option.setName('title').setDescription('Ticket embed title').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('Ticket embed description').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('footer').setDescription('Ticket embed footer text').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('color').setDescription('Ticket embed hex color like #00ff00').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('image_url').setDescription('Ticket embed image URL').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('ticket_field1_name').setDescription('Ticket field 1 name').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('ticket_field1_value').setDescription('Ticket field 1 value').setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('ticket_field1_inline').setDescription('Ticket field 1 inline?').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('ticket_field2_name').setDescription('Ticket field 2 name').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('ticket_field2_value').setDescription('Ticket field 2 value').setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('ticket_field2_inline').setDescription('Ticket field 2 inline?').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('ticket_field3_name').setDescription('Ticket field 3 name').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('ticket_field3_value').setDescription('Ticket field 3 value').setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('ticket_field3_inline').setDescription('Ticket field 3 inline?').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('publish').setDescription('Publish or update the ticket panel message')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('clearpanels').setDescription('Delete every active ticket panel message in the configured channel')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('resetembed').setDescription('Clear saved ticket embed data and start from a blank panel')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Show current ticket panel settings')
    ),
  requiredPermissions: PermissionFlagsBits.ManageChannels,

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = getTicketConfig(guildId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setpanel') {
      const channel = interaction.options.getChannel('channel');
      const updated = setTicketConfig(guildId, { panelChannelId: channel.id });
      await interaction.reply({ content: `Ticket panel channel set to ${channel}.`, ephemeral: true });
      return updated;
    }

    if (subcommand === 'setcategory') {
      const category = interaction.options.getChannel('category');
      const updated = setTicketConfig(guildId, { categoryId: category.id });
      await interaction.reply({ content: `Ticket category set to ${category}.`, ephemeral: true });
      return updated;
    }

    if (subcommand === 'setstaff') {
      const role = interaction.options.getRole('role');
      const updated = setTicketConfig(guildId, { staffRoleId: role.id });
      await interaction.reply({ content: `Ticket staff role set to ${role}.`, ephemeral: true });
      return updated;
    }

    if (subcommand === 'settranscript') {
      const channel = interaction.options.getChannel('channel');
      const updated = setTicketConfig(guildId, { transcriptChannelId: channel.id });
      await interaction.reply({ content: `Ticket transcript channel set to ${channel}.`, ephemeral: true });
      return updated;
    }

    if (subcommand === 'editembeds') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'Please choose a text channel.',
          ephemeral: true
        });
        return;
      }

      setTicketConfig(guildId, { panelChannelId: channel.id });

      await interaction.reply({
        content: `Choose a slot to edit embeds for ${channel}. Click a slot to open the editor.`,
        components: buildSlotPickerComponents(null, channel.id),
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'editpanel') {
      const buttonLabel = interaction.options.getString('button_label');
      const buttonStyle = interaction.options.getString('button_style');

      setTicketConfig(guildId, {
        panelButtonLabel: buttonLabel ?? config.panelButtonLabel,
        panelButtonStyle: buttonStyle ?? config.panelButtonStyle
      });

      await interaction.reply({ content: 'Ticket button settings updated.', ephemeral: true });
      return;
    }

    if (subcommand === 'editticket') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const footer = interaction.options.getString('footer');
      const colorInput = interaction.options.getString('color');

      const ticketColor = colorInput !== null ? parseHexColor(colorInput) : config.ticketColor;
      if (colorInput !== null && ticketColor === null) {
        await interaction.reply({ content: 'Ticket color must be a 6-digit hex value like #00ff00.', ephemeral: true });
        return;
      }

      const imageUrl = interaction.options.getString('image_url');
      const ticketFields = [
        {
          name: interaction.options.getString('ticket_field1_name'),
          value: interaction.options.getString('ticket_field1_value'),
          inline: interaction.options.getBoolean('ticket_field1_inline')
        },
        {
          name: interaction.options.getString('ticket_field2_name'),
          value: interaction.options.getString('ticket_field2_value'),
          inline: interaction.options.getBoolean('ticket_field2_inline')
        },
        {
          name: interaction.options.getString('ticket_field3_name'),
          value: interaction.options.getString('ticket_field3_value'),
          inline: interaction.options.getBoolean('ticket_field3_inline')
        }
      ].filter((field) => field.name && field.value);

      setTicketConfig(guildId, {
        ticketTitle: title ?? config.ticketTitle,
        ticketDescription: description ?? config.ticketDescription,
        ticketFooter: footer ?? config.ticketFooter,
        ticketColor,
        ticketFields: ticketFields.length ? ticketFields : config.ticketFields,
        ticketImageUrl: imageUrl ?? config.ticketImageUrl
      });

      await interaction.reply({ content: 'Ticket message configuration updated. New tickets will use the updated text and color.', ephemeral: true });
      return;
    }

    if (subcommand === 'publish') {
      await interaction.deferReply({ ephemeral: true });
      
      if (!config.panelChannelId) {
        await interaction.editReply({ content: 'Set the ticket panel channel first with /ticket editembeds.' });
        return;
      }
      const channel = interaction.guild.channels.cache.get(config.panelChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({ content: 'The configured ticket panel channel is invalid. Set it again.' });
        return;
      }

      const messageId = await publishTicketPanel(channel, config);
      if (messageId) {
        setTicketConfig(guildId, { messageId });
      }
      await interaction.editReply({ content: `Ticket panel published in ${channel}.` });
      return;
    }

    if (subcommand === 'clearpanels') {
      await interaction.deferReply({ ephemeral: true });

      if (!config.panelChannelId) {
        await interaction.editReply({ content: 'No ticket panel channel is configured yet.' });
        return;
      }

      const channel = interaction.guild.channels.cache.get(config.panelChannelId) || await interaction.guild.channels.fetch(config.panelChannelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({ content: 'The configured ticket panel channel is invalid or no longer available.' });
        return;
      }

      const deleted = await clearTicketPanelsInChannel(channel);
      setTicketConfig(guildId, {
        messageId: null,
        panelChannelId: channel.id,
        panelEmbeds: [],
        openTickets: {},
        panelTitle: null,
        panelDescription: null,
        panelButtonLabel: null,
        panelButtonStyle: null,
        panelFooter: null,
        panelColor: null,
        panelFields: [],
        ticketTitle: null,
        ticketDescription: null,
        ticketFooter: null,
        ticketColor: null,
        ticketFields: [],
        ticketImageUrl: null
      });
      await interaction.editReply({ content: `Removed ${deleted} bot message(s) from ${channel}. The saved ticket state has been cleared. You can publish a fresh panel afterward.` });
      return;
    }

    if (subcommand === 'resetembed') {
      await interaction.deferReply({ ephemeral: true });

      const blankState = {
        messageId: null,
        panelChannelId: config.panelChannelId || null,
        categoryId: config.categoryId || null,
        staffRoleId: config.staffRoleId || null,
        transcriptChannelId: config.transcriptChannelId || null,
        openTickets: {},
        panelTitle: null,
        panelDescription: null,
        panelButtonLabel: null,
        panelButtonStyle: null,
        panelFooter: null,
        panelColor: null,
        panelFields: [],
        panelEmbeds: [],
        ticketTitle: null,
        ticketDescription: null,
        ticketFooter: null,
        ticketColor: null,
        ticketFields: [],
        ticketImageUrl: null
      };

      setTicketConfig(guildId, blankState);

      if (config.panelChannelId) {
        const channel = interaction.guild.channels.cache.get(config.panelChannelId) || await interaction.guild.channels.fetch(config.panelChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          await clearTicketPanelsInChannel(channel);
        }
      }

      await interaction.editReply({ content: 'Ticket embed state has been reset to blank. Publish a fresh panel to start from a clean state.' });
      return;
    }

    if (subcommand === 'status') {
      const lines = [];
      lines.push(`Panel channel: ${config.panelChannelId ? `<#${config.panelChannelId}>` : 'Not set'}`);
      lines.push(`Ticket category: ${config.categoryId ? `<#${config.categoryId}>` : 'Not set'}`);
      lines.push(`Staff role: ${config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Not set'}`);
      lines.push(`Panel message ID: ${config.messageId || 'Not set'}`);
      lines.push(`Panel button label: ${config.panelButtonLabel || 'Open Ticket'}`);
      lines.push(`Panel button style: ${config.panelButtonStyle || 'Success'}`);
      lines.push(`Ticket title: ${config.ticketTitle || 'Default'}`);
      lines.push(`Ticket description: ${config.ticketDescription || 'Default'}`);
      lines.push(`Ticket color: ${config.ticketColor ? `#${config.ticketColor.toString(16).padStart(6, '0')}` : 'Default'}`);
      lines.push(`Ticket image URL: ${config.ticketImageUrl || 'None'}`);
      lines.push(`Ticket fields: ${config.ticketFields?.length ? config.ticketFields.map((f) => f.name).join(', ') : 'None'}`);
      const openCount = config.openTickets ? Object.keys(config.openTickets).length : 0;
      lines.push(`Open tickets: ${openCount}`);
      lines.push(`Transcript channel: ${config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : 'Not set'}`);
      const embedCount = config.panelEmbeds?.filter((e) => hasEmbedContent(e)).length || 0;
      lines.push(`Configured embeds: ${embedCount}/10`);
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }
  }
};
