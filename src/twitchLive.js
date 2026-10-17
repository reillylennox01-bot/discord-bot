import dotenv from 'dotenv';
import { EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildConfig } from './utils/settings.js';

dotenv.config();

const CHECK_INTERVAL_MS = 60_000;
let accessToken = null;
let tokenExpiresAt = 0;
const liveStreamCache = new Map();
const broadcasterIdCache = new Map();

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

async function getTwitchAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set.');
  }

  const now = Date.now();
  if (accessToken && now < tokenExpiresAt) {
    return accessToken;
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
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 30_000;
  return accessToken;
}

async function fetchTwitchUser(streamer) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAccessToken();

  const url = new URL('https://api.twitch.tv/helix/users');
  url.searchParams.set('login', streamer);

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

async function fetchSubscriptions(broadcasterId) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = process.env.TWITCH_BROADCASTER_TOKEN;
  if (!token) {
    throw new Error('TWITCH_BROADCASTER_TOKEN must be set to fetch subscriptions.');
  }

  const url = new URL('https://api.twitch.tv/helix/subscriptions');
  url.searchParams.set('broadcaster_id', broadcasterId);
  url.searchParams.set('first', '100');

  const response = await fetch(url.toString(), {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitch subscriptions API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.data ?? [];
}

export async function assignRoleIfSubscribed(guild, twitchName, discordId) {
  const config = getGuildConfig(guild.id);
  if (!config.twitchStreamer || !config.twitchSubRoleId) return { success: false, reason: 'notConfigured' };

  let broadcasterId;
  try {
    broadcasterId = await getBroadcasterId(config.twitchStreamer);
  } catch (error) {
    console.error('Failed to resolve Twitch streamer for assignRoleIfSubscribed:', error.message);
    return { success: false, reason: 'apiError' };
  }

  if (!broadcasterId) {
    return { success: false, reason: 'streamerNotFound' };
  }

  let subscriptions;
  try {
    subscriptions = await fetchSubscriptions(broadcasterId);
  } catch (error) {
    console.error('Failed to fetch Twitch subscriptions:', error.message);
    return { success: false, reason: 'apiError' };
  }

  const lowerName = twitchName.toLowerCase();
  const isSubscribed = subscriptions.some((sub) => sub.user_login.toLowerCase() === lowerName);
  if (!isSubscribed) {
    return { success: false, reason: 'notSubscribed' };
  }

  const role = await guild.roles.fetch(config.twitchSubRoleId).catch(() => null);
  if (!role) {
    return { success: false, reason: 'roleNotFound' };
  }

  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) {
    return { success: false, reason: 'memberNotFound' };
  }

  if (member.roles.cache.has(role.id)) {
    return { success: true, reason: 'alreadyHasRole' };
  }

  try {
    await member.roles.add(role, 'Twitch subscriber role assignment');
    return { success: true, reason: 'roleAssigned' };
  } catch (error) {
    console.error(`Failed to assign subscriber role to ${discordId}:`, error.message);
    return { success: false, reason: 'roleAssignFailed' };
  }
}

function buildLiveEmbed(stream) {
  const thumbnail = stream.thumbnail_url
    .replace('{width}', '1280')
    .replace('{height}', '720') + `?rand=${Date.now()}`;

  return new EmbedBuilder()
    .setColor(0x9146ff)
    .setTitle(`${stream.user_name} is live on Twitch!`)
    .setURL(`https://www.twitch.tv/${stream.user_login}`)
    .setDescription(stream.title || 'Click to watch the stream now.')
    .addFields(
      { name: 'Game', value: stream.game_name || 'Unknown', inline: true },
      { name: 'Viewers', value: `${stream.viewer_count}`, inline: true }
    )
    .setImage(thumbnail)
    .setTimestamp(new Date(stream.started_at))
    .setFooter({ text: 'Twitch Live Notification' });
}

async function getBroadcasterId(streamer) {
  if (broadcasterIdCache.has(streamer)) {
    return broadcasterIdCache.get(streamer);
  }

  const user = await fetchTwitchUser(streamer);
  if (!user) {
    return null;
  }

  broadcasterIdCache.set(streamer, user.id);
  return user.id;
}

async function assignSubscriptionRoles(guild, config) {
  if (!config.twitchStreamer || !config.twitchSubRoleId) return;
  const linkedAccounts = config.twitchLinkedAccounts || {};
  if (!Object.keys(linkedAccounts).length) return;

  let broadcasterId;
  try {
    broadcasterId = await getBroadcasterId(config.twitchStreamer);
  } catch (error) {
    console.error('Failed to resolve Twitch streamer for subscription checks:', error.message);
    return;
  }

  if (!broadcasterId) {
    console.warn(`Could not find Twitch broadcaster ID for ${config.twitchStreamer}`);
    return;
  }

  let subscriptions;
  try {
    subscriptions = await fetchSubscriptions(broadcasterId);
  } catch (error) {
    console.error('Twitch subscription check failed for', guild.id, config.twitchStreamer, error.message);
    return;
  }

  const activeLogins = new Set(subscriptions.map((sub) => sub.user_login.toLowerCase()));
  const role = guild.roles.cache.get(config.twitchSubRoleId) || await guild.roles.fetch(config.twitchSubRoleId).catch(() => null);
  if (!role) {
    console.warn(`Twitch subscriber role invalid for guild ${guild.id}`);
    return;
  }

  const notifyChannel = config.twitchNotifyChannelId
    ? await guild.channels.fetch(config.twitchNotifyChannelId).catch(() => null)
    : null;

  for (const [twitchName, discordId] of Object.entries(linkedAccounts)) {
    if (!activeLogins.has(twitchName)) continue;

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) continue;
    if (member.roles.cache.has(role.id)) continue;

    try {
      await member.roles.add(role, 'Twitch subscriber role assignment');
      if (notifyChannel && notifyChannel.type === ChannelType.GuildText) {
        await notifyChannel.send(`✅ Assigned <@&${role.id}> to <@${member.id}> because their Twitch account **${twitchName}** is currently subscribed.`).catch(() => null);
      }
    } catch (error) {
      console.error(`Failed to assign Twitch subscriber role in guild ${guild.id} to member ${member.id}:`, error.message);
    }
  }
}

async function checkGuild(client, guild) {
  const config = getGuildConfig(guild.id);
  const streamer = config.twitchStreamer;
  const channelId = config.twitchNotifyChannelId;

  if (!streamer || !channelId) {
    liveStreamCache.delete(guild.id);
  } else {
    let stream;
    try {
      stream = await fetchStream(streamer);
    } catch (error) {
      console.error('Twitch check failed for', guild.id, streamer, error.message);
    }

    const previousStreamId = liveStreamCache.get(guild.id) || null;

    if (stream && stream.id !== previousStreamId) {
      liveStreamCache.set(guild.id, stream.id);
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.type === ChannelType.GuildText) {
        const embed = buildLiveEmbed(stream);
        const pingRoleId = config.twitchNotifyRoleId;
        const roleMention = pingRoleId ? `<@&${pingRoleId}> ` : '';
        await channel.send({
          content: `${roleMention}🔴 **${stream.user_name} is now live on Twitch!**`,
          embeds: [embed],
          allowedMentions: { roles: pingRoleId ? [pingRoleId] : [] }
        }).catch(() => null);
      } else {
        console.warn(`Twitch notify channel invalid for guild ${guild.id}`);
      }
    }

    if (!stream) {
      liveStreamCache.set(guild.id, null);
    }
  }

  await assignSubscriptionRoles(guild, config);
}

async function checkAllGuilds(client) {
  for (const guild of client.guilds.cache.values()) {
    await checkGuild(client, guild);
  }
}

export async function startTwitchLiveChecker(client) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.warn('Twitch notification disabled: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET is missing.');
    return;
  }

  await checkAllGuilds(client);
  setInterval(() => checkAllGuilds(client), CHECK_INTERVAL_MS);
}
