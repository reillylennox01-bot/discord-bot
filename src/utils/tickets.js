import { getGuildConfig, setGuildConfig } from './settings.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } from 'discord.js';

export function getTicketConfig(guildId) {
  const config = getGuildConfig(guildId);
  return config.ticket || {
    panelChannelId: null,
    messageId: null,
    categoryId: null,
    staffRoleId: null,
    transcriptChannelId: null,
    openTickets: {},
    panelTitle: null,
    panelDescription: null,
    panelButtonLabel: null,
    panelButtonStyle: null,
    panelFooter: null,
    panelColor: null,
    panelFields: [],
    panelEmbeds: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
    ticketTitle: null,
    ticketDescription: null,
    ticketFooter: null,
    ticketColor: null,
    ticketFields: [],
    ticketImageUrl: null
  };
}

export function setTicketConfig(guildId, ticketConfig) {
  const config = getGuildConfig(guildId);
  const merged = {
    ...getTicketConfig(guildId),
    ...ticketConfig
  };
  setGuildConfig(guildId, { ticket: merged });
  return merged;
}

export function addOpenTicket(guildId, userId, channelId) {
  const config = getTicketConfig(guildId);
  const openTickets = { ...(config.openTickets || {}), [userId]: channelId };
  return setTicketConfig(guildId, { ...config, openTickets });
}

export function removeOpenTicket(guildId, userId) {
  const config = getTicketConfig(guildId);
  const openTickets = { ...(config.openTickets || {}) };
  delete openTickets[userId];
  return setTicketConfig(guildId, { ...config, openTickets });
}

export function findTicketChannel(guildId, userId) {
  const config = getTicketConfig(guildId);
  return config.openTickets?.[userId] || null;
}

export function findTicketOwnerByChannel(guildId, channelId) {
  const config = getTicketConfig(guildId);
  const entries = Object.entries(config.openTickets || {});
  const found = entries.find(([, id]) => id === channelId);
  return found ? found[0] : null;
}

export async function publishTicketPanel(channel, config) {
  const panelEmbeds = [];

  if (config.panelEmbeds && Array.isArray(config.panelEmbeds)) {
    for (let i = 0; i < config.panelEmbeds.length; i++) {
      const embedConfig = config.panelEmbeds[i];
      if (!embedConfig || (!embedConfig.title && !embedConfig.description && !embedConfig.image_url)) continue;

      const embed = new EmbedBuilder();
      if (embedConfig.title) {
        embed.setTitle(embedConfig.title);
      } else {
        embed.setTitle('Untitled');
      }
      if (embedConfig.description) {
        embed.setDescription(embedConfig.description);
      }
      embed.setColor(embedConfig.color ?? 0x5865f2);

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

      panelEmbeds.push(embed);
    }
  }

  const openButton = new ButtonBuilder()
    .setCustomId('ticket_open:pending')
    .setLabel(config.panelButtonLabel || 'Open Ticket')
    .setStyle(ButtonStyle[config.panelButtonStyle] || ButtonStyle.Success);
  const rows = [new ActionRowBuilder().addComponents(openButton)];

  const embeds = panelEmbeds.length > 0 ? panelEmbeds : [
    new EmbedBuilder()
      .setTitle('No saved embeds')
      .setDescription('No embeds have been configured yet.')
      .setColor(0x5865f2)
  ];

  if (!channel || !channel.isTextBased()) {
    throw new Error('Invalid channel provided for ticket panel publishing.');
  }

  const trackedMessageId = config.messageId || null;
  if (trackedMessageId) {
    const trackedMessage = await channel.messages.fetch(trackedMessageId).catch(() => null);
    if (trackedMessage) {
      await trackedMessage.edit({ embeds, components: rows }).catch((error) => {
        console.error('Failed to update tracked ticket panel message:', error);
      });
      return trackedMessage.id;
    }
  }

  let lastMessageId = null;
  let page = 0;
  const staleMessages = [];

  while (page < 20) {
    const options = { limit: 100 };
    if (lastMessageId) options.before = lastMessageId;

    const fetched = await channel.messages.fetch(options).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    for (const msg of fetched.values()) {
      if (msg.id === trackedMessageId) continue;
      if (!msg.author?.bot) continue;

      const customs = msg.components
        .flatMap((row) => row.components.map((component) => component.customId))
        .filter(Boolean);

      const isTicketPanel = customs.some((customId) =>
        customId === 'ticket_open' ||
        customId === 'ticket_open:pending' ||
        customId?.startsWith('ticket_open:') ||
        customId?.startsWith('ticket_embed_') ||
        customId?.startsWith('ticketedit_slot:') ||
        customId === 'ticketedit_preview' ||
        customId?.startsWith('ticketedit_preview:') ||
        customId === 'ticketedit_send' ||
        customId?.startsWith('ticketedit_send:') ||
        customId === 'ticketedit_clear' ||
        customId?.startsWith('ticketedit_clear:')
      );

      if (isTicketPanel || msg.content?.includes('Open Ticket') || msg.embeds.some((embed) => embed.title?.includes('Support Ticket') || embed.description?.includes('support tickets'))) {
        staleMessages.push(msg);
      }
    }

    if (fetched.size < 100) break;
    lastMessageId = fetched.last().id;
    page += 1;
  }

  if (staleMessages.length > 0) {
    console.log(`publishTicketPanel: deleting ${staleMessages.length} stale ticket panel message(s) in ${channel.id}`);
    await Promise.all(
      staleMessages.map((msg) => msg.delete().catch((error) => {
        console.error('Failed to delete stale ticket panel message:', error);
      }))
    );
  }

  const message = await channel.send({ embeds, components: rows });

  if (message) {
    const finalButton = new ButtonBuilder()
      .setCustomId(`ticket_open:${message.id}`)
      .setLabel(config.panelButtonLabel || 'Open Ticket')
      .setStyle(ButtonStyle[config.panelButtonStyle] || ButtonStyle.Success);

    await message.edit({
      embeds: message.embeds,
      components: [new ActionRowBuilder().addComponents(finalButton)]
    }).catch((error) => {
      console.error('Failed to bind live ticket panel button ID:', error);
    });
  }

  return message?.id || null;
}
