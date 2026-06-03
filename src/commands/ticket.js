import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { getTicketConfig, setTicketConfig, addOpenTicket, removeOpenTicket, findTicketOwnerByChannel } from '../utils/tickets.js';

function parseHexColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }
  return Number(`0x${normalized}`);
}

function buildTicketPanelEmbed(config) {
  const embed = new EmbedBuilder()
    .setTitle(config.panelTitle || 'Open a Support Ticket')
    .setDescription(config.panelDescription || 'Press the button below to open a private ticket channel for support.')
    .setColor(config.panelColor ?? 0x5865f2)
    .setFooter({ text: config.panelFooter || 'A new ticket will be created for you.' });

  if (config.panelFields?.length) {
    for (const field of config.panelFields) {
      if (!field.name || !field.value) continue;
      embed.addFields({ name: field.name, value: field.value, inline: !!field.inline });
    }
  }

  return embed;
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

async function publishTicketPanel(channel, config) {
  const embed = buildTicketPanelEmbed(config);
  const button = new ButtonBuilder()
    .setCustomId('ticket_open')
    .setLabel(config.panelButtonLabel || 'Open Ticket')
    .setStyle(ButtonStyle[config.panelButtonStyle] || ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);
  let message = null;

  if (config.messageId) {
    message = await channel.messages.fetch(config.messageId).catch(() => null);
  }

  if (message) {
    await message.edit({ embeds: [embed], components: [row] }).catch(() => null);
  } else {
    message = await channel.send({ embeds: [embed], components: [row] });
  }

  return message?.id || null;
}

function buildTicketChannelName(user) {
  const baseName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'ticket';
  return `ticket-${baseName}-${user.id.slice(-4)}`;
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
        .setName('editpanel')
        .setDescription('Edit the ticket panel message content')
        .addStringOption((option) =>
          option.setName('title').setDescription('Panel embed title').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('Panel embed description').setRequired(false)
        )
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
        .addStringOption((option) =>
          option.setName('footer').setDescription('Panel embed footer text').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('color').setDescription('Panel embed hex color like #5865f2').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('panel_field1_name').setDescription('Panel field 1 name').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('panel_field1_value').setDescription('Panel field 1 value').setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('panel_field1_inline').setDescription('Panel field 1 inline?').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('panel_field2_name').setDescription('Panel field 2 name').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('panel_field2_value').setDescription('Panel field 2 value').setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('panel_field2_inline').setDescription('Panel field 2 inline?').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('panel_field3_name').setDescription('Panel field 3 name').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('panel_field3_value').setDescription('Panel field 3 value').setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('panel_field3_inline').setDescription('Panel field 3 inline?').setRequired(false)
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

    if (subcommand === 'editpanel') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const buttonLabel = interaction.options.getString('button_label');
      const footer = interaction.options.getString('footer');
      const colorInput = interaction.options.getString('color');

      const panelColor = colorInput !== null ? parseHexColor(colorInput) : config.panelColor;
      if (colorInput !== null && panelColor === null) {
        await interaction.reply({ content: 'Panel color must be a 6-digit hex value like #5865f2.', ephemeral: true });
        return;
      }

      const panelFields = [
        {
          name: interaction.options.getString('panel_field1_name'),
          value: interaction.options.getString('panel_field1_value'),
          inline: interaction.options.getBoolean('panel_field1_inline')
        },
        {
          name: interaction.options.getString('panel_field2_name'),
          value: interaction.options.getString('panel_field2_value'),
          inline: interaction.options.getBoolean('panel_field2_inline')
        },
        {
          name: interaction.options.getString('panel_field3_name'),
          value: interaction.options.getString('panel_field3_value'),
          inline: interaction.options.getBoolean('panel_field3_inline')
        }
      ].filter((field) => field.name && field.value);

      const buttonStyle = interaction.options.getString('button_style');
      const updatedConfig = setTicketConfig(guildId, {
        panelTitle: title ?? config.panelTitle,
        panelDescription: description ?? config.panelDescription,
        panelButtonLabel: buttonLabel ?? config.panelButtonLabel,
        panelButtonStyle: buttonStyle ?? config.panelButtonStyle,
        panelFooter: footer ?? config.panelFooter,
        panelColor,
        panelFields: panelFields.length ? panelFields : config.panelFields
      });

      if (updatedConfig.panelChannelId) {
        const channel = await interaction.guild.channels.fetch(updatedConfig.panelChannelId).catch(() => null);
        if (channel && channel.type === ChannelType.GuildText) {
          const messageId = await publishTicketPanel(channel, updatedConfig);
          if (messageId) {
            setTicketConfig(guildId, { messageId });
          }
        }
      }

      await interaction.reply({ content: 'Ticket panel configuration updated.', ephemeral: true });
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
      if (!config.panelChannelId) {
        await interaction.reply({ content: 'Set the ticket panel channel first with /ticket setpanel.', ephemeral: true });
        return;
      }
      const channel = interaction.guild.channels.cache.get(config.panelChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'The configured ticket panel channel is invalid. Set it again.', ephemeral: true });
        return;
      }

      const messageId = await publishTicketPanel(channel, config);
      if (messageId) {
        setTicketConfig(guildId, { messageId });
      }
      await interaction.reply({ content: `Ticket panel published in ${channel}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'status') {
      const lines = [];
      lines.push(`Panel channel: ${config.panelChannelId ? `<#${config.panelChannelId}>` : 'Not set'}`);
      lines.push(`Ticket category: ${config.categoryId ? `<#${config.categoryId}>` : 'Not set'}`);
      lines.push(`Staff role: ${config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Not set'}`);
      lines.push(`Panel message ID: ${config.messageId || 'Not set'}`);
      lines.push(`Panel title: ${config.panelTitle || 'Default'}`);
      lines.push(`Panel description: ${config.panelDescription || 'Default'}`);
      lines.push(`Panel button label: ${config.panelButtonLabel || 'Open Ticket'}`);
      lines.push(`Panel button style: ${config.panelButtonStyle || 'Primary'}`);
      lines.push(`Panel color: ${config.panelColor ? `#${config.panelColor.toString(16).padStart(6, '0')}` : 'Default'}`);
      lines.push(`Panel fields: ${config.panelFields?.length ? config.panelFields.map((f) => f.name).join(', ') : 'None'}`);
      lines.push(`Ticket title: ${config.ticketTitle || 'Default'}`);
      lines.push(`Ticket description: ${config.ticketDescription || 'Default'}`);
      lines.push(`Ticket color: ${config.ticketColor ? `#${config.ticketColor.toString(16).padStart(6, '0')}` : 'Default'}`);
      lines.push(`Ticket image URL: ${config.ticketImageUrl || 'None'}`);
      lines.push(`Ticket fields: ${config.ticketFields?.length ? config.ticketFields.map((f) => f.name).join(', ') : 'None'}`);
      const openCount = config.openTickets ? Object.keys(config.openTickets).length : 0;
      lines.push(`Open tickets: ${openCount}`);
      lines.push(`Transcript channel: ${config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : 'Not set'}`);
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }
  }
};
