import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';

async function getTwitchAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const response = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
    method: 'POST'
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to get Twitch token: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchStream(streamer) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAccessToken();

  const url = new URL('https://api.twitch.tv/helix/streams');
  url.searchParams.set('user_login', streamer);

  const response = await fetch(url.toString(), {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitch API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.data?.[0] ?? null;
}

export default {
  name: 'twitchstatus',
  description: 'Show the configured Twitch streamer and live notification status',
  async execute(message) {
    const config = getGuildConfig(message.guild.id);
    const streamer = config.twitchStreamer;
    const channelId = config.twitchNotifyChannelId;

    if (!streamer || !channelId) {
      await message.reply({ content: 'Twitch notifications are not configured yet. Ask a staff member to use /setstreamer.', ephemeral: true });
      return;
    }

    const channel = message.guild.channels.cache.get(channelId);
    const channelMention = channel ? `<#${channelId}>` : channelId;

    let stream = null;
    let statusText = 'Unknown';

    try {
      stream = await fetchStream(streamer);
      statusText = stream ? 'Live now' : 'Offline';
    } catch (error) {
      statusText = `Error checking status: ${error.message}`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Twitch Status')
      .setColor(stream ? 0x9146ff : 0x808080)
      .addFields(
        { name: 'Streamer', value: streamer, inline: true },
        { name: 'Notify Channel', value: channelMention, inline: true },
        { name: 'Status', value: statusText, inline: true }
      )
      .setTimestamp();

    if (stream) {
      embed
        .addFields(
          { name: 'Title', value: stream.title || 'No stream title', inline: false },
          { name: 'Game', value: stream.game_name || 'Unknown', inline: true },
          { name: 'Viewers', value: `${stream.viewer_count}`, inline: true }
        )
        .setURL(`https://www.twitch.tv/${stream.user_login}`)
        .setImage(stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720') + `?rand=${Date.now()}`);
    }

    await message.reply({ embeds: [embed] });
  }
};
