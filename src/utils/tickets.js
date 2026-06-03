import { getGuildConfig, setGuildConfig } from './settings.js';

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
