import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { publishTicketPanel } from './src/utils/tickets.js';

dotenv.config();

const guildId = '1507436010118709470';
const channelId = '1508438785719799879';
const settingsFile = path.resolve('./data/guildSettings.json');

const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
if (!settings[guildId]) settings[guildId] = {};
if (!settings[guildId].ticket) settings[guildId].ticket = {};

settings[guildId].ticket.panelChannelId = channelId;
settings[guildId].ticket.messageId = null;
settings[guildId].ticket.panelEmbeds = settings[guildId].ticket.panelEmbeds || [];

fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a valid text channel.`);
    }

    const messageId = await publishTicketPanel(channel, settings[guildId].ticket);
    settings[guildId].ticket.messageId = messageId;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

    console.log('PANEL_SENT', { guildId, channelId, messageId });
  } catch (error) {
    console.error('PANEL_ERROR', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('LOGIN_ERROR', error);
  process.exit(1);
});
