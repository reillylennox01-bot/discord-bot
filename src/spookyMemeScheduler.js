import { EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildConfig } from './utils/settings.js';

const spookyMemes = [
  {
    title: 'When the skeleton DJ drops the beat',
    description: '💀 “I came for the boos and stayed for the bass.”',
    color: '#7B1FA2'
  },
  {
    title: '3AM Snack Attack',
    description: '👻 The ghost in the fridge: “I only haunt the snacks.”',
    color: '#E91E63'
  },
  {
    title: 'Witchy WiFi',
    description: '🧙‍♀️ “My internet is spooky slow... must be a hex.”',
    color: '#3F51B5'
  },
  {
    title: 'Haunted Mirror Selfie',
    description: '📸 When your reflection says “BOO” and your camera still gets strong Wi-Fi.',
    color: '#FF5722'
  },
  {
    title: 'Midnight Moth Meme',
    description: '🦋 “Why is this room suddenly full of moths? Because the light is a vibe.”',
    color: '#009688'
  }
];

function getRandomMeme() {
  return spookyMemes[Math.floor(Math.random() * spookyMemes.length)];
}

function buildSpookyEmbed() {
  const meme = getRandomMeme();
  return new EmbedBuilder()
    .setTitle(meme.title)
    .setDescription(meme.description)
    .setColor(meme.color)
    .setFooter({ text: 'Spooky meme delivered at 3AM' })
    .setTimestamp();
}

function getNext3AMUtcOffset() {
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);
  if (next3AM <= now) {
    next3AM.setDate(next3AM.getDate() + 1);
  }
  return next3AM;
}

async function sendSpookyMemeToGuild(client, guildId) {
  const config = getGuildConfig(guildId);
  if (!config.spookyMemeEnabled || !config.spookyMemeChannelId) return;

  const channel = await client.channels.fetch(config.spookyMemeChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.send({ embeds: [buildSpookyEmbed()] }).catch(() => null);
}

async function sendSpookyMemes(client) {
  for (const guild of client.guilds.cache.values()) {
    await sendSpookyMemeToGuild(client, guild.id);
  }
}

export function startSpookyMemeScheduler(client) {
  async function scheduleNext() {
    const nextRun = getNext3AMUtcOffset();
    const delay = nextRun.getTime() - Date.now();
    setTimeout(async () => {
      await sendSpookyMemes(client).catch(() => null);
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}
