import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildConfig } from './utils/settings.js';

const MEME_TIME_ZONE = 'Europe/London';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_MEME_DIR = path.join(__dirname, 'data', 'memes');
const LOCAL_MEME_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function getLocalMemeFiles() {
  if (!fs.existsSync(LOCAL_MEME_DIR)) {
    return [];
  }

  return fs
    .readdirSync(LOCAL_MEME_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LOCAL_MEME_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(LOCAL_MEME_DIR, entry.name));
}

function getRandomLocalMeme() {
  const files = getLocalMemeFiles();
  if (files.length === 0) {
    return null;
  }

  const filePath = files[Math.floor(Math.random() * files.length)];
  const baseName = path.parse(filePath).name.replace(/[_-]+/g, ' ').trim();
  const isGeneratedName = /^image\s+\d+$/.test(baseName);

  return {
    title: isGeneratedName ? '3AM spooky meme drop' : baseName || '3AM spooky meme drop',
    imagePath: filePath,
    fileName: path.basename(filePath),
    color: '#7B1FA2'
  };
}

async function getMeme() {
  const localMeme = getRandomLocalMeme();
  return localMeme;
}

async function buildSpookyMemePayload() {
  const meme = await getMeme();
  if (!meme) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(meme.color);

  const payload = { embeds: [embed] };

  if (meme.imagePath) {
    embed.setImage(`attachment://${meme.fileName}`);
    payload.files = [meme.imagePath];
  } else {
    embed.setImage(meme.imageUrl);
  }

  if (meme.sourceUrl) {
    embed.setURL(meme.sourceUrl);
  }

  return payload;
}

function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return zonedAsUtc - date.getTime();
}

function zonedTimeToUtc(localDateTime, timeZone) {
  const utcGuess = new Date(
    Date.UTC(
      localDateTime.year,
      localDateTime.month - 1,
      localDateTime.day,
      localDateTime.hour,
      localDateTime.minute,
      localDateTime.second,
      0
    )
  );

  let offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  let result = new Date(utcGuess.getTime() - offset);
  const adjustedOffset = getTimeZoneOffsetMs(result, timeZone);

  if (adjustedOffset !== offset) {
    offset = adjustedOffset;
    result = new Date(utcGuess.getTime() - offset);
  }

  return result;
}

function addDaysToUtcDateParts(year, month, day, daysToAdd) {
  const date = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function getNext3AMLondon() {
  const now = new Date();
  const londonNow = getTimeZoneParts(now, MEME_TIME_ZONE);
  const shouldUseTomorrow =
    londonNow.hour > 3 ||
    (londonNow.hour === 3 && (londonNow.minute > 0 || londonNow.second > 0));

  const targetDate = addDaysToUtcDateParts(
    londonNow.year,
    londonNow.month,
    londonNow.day,
    shouldUseTomorrow ? 1 : 0
  );

  return zonedTimeToUtc(
    {
      ...targetDate,
      hour: 3,
      minute: 0,
      second: 0
    },
    MEME_TIME_ZONE
  );
}

export async function sendSpookyMemeToChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;

  const payload = await buildSpookyMemePayload();
  if (!payload) {
    return false;
  }

  await channel.send(payload).catch(() => null);
  return true;
}

async function sendSpookyMemeToGuild(client, guildId) {
  const config = getGuildConfig(guildId);
  if (!config.spookyMemeEnabled || !config.spookyMemeChannelId) return;

  const channel = await client.channels.fetch(config.spookyMemeChannelId).catch(() => null);
  await sendSpookyMemeToChannel(channel);
}

async function sendSpookyMemes(client) {
  for (const guild of client.guilds.cache.values()) {
    await sendSpookyMemeToGuild(client, guild.id);
  }
}

export function startSpookyMemeScheduler(client) {
  async function scheduleNext() {
    const nextRun = getNext3AMLondon();
    const delay = nextRun.getTime() - Date.now();
    setTimeout(async () => {
      await sendSpookyMemes(client).catch(() => null);
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}