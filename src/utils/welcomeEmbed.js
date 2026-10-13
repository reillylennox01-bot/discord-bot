import { EmbedBuilder } from 'discord.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
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

export function buildWelcomeEmbed(guild, user, config) {
  const thumbnailUrl = normalizeHttpUrl(config.thumbnailUrl);
  const imageUrl = normalizeHttpUrl(config.imageUrl);
  const footerIconUrl = normalizeHttpUrl(config.footerIconUrl);
  const authorIconUrl = normalizeHttpUrl(config.authorIconUrl);

  const embed = new EmbedBuilder()
    .setColor(parseColor(config.color) ?? 0x00ff00)
    .setTitle(config.title || `Welcome to ${guild.name}!`)
    .setDescription(
      config.description || `Hello ${user}, welcome to **${guild.name}**! We're happy to have you here.`
    )
    .setFooter({ text: config.footer || 'Welcome message', iconURL: footerIconUrl ?? undefined })
    .setTimestamp();

  if (thumbnailUrl) {
    embed.setThumbnail(thumbnailUrl);
  }

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  if (config.authorName) {
    embed.setAuthor({ name: config.authorName, iconURL: authorIconUrl ?? undefined });
  }

  return embed;
}

export function hasWelcomeEmbedContent(data) {
  return Boolean(
    data?.title ||
      data?.description ||
      data?.image_url ||
      data?.imageUrl ||
      data?.thumbnail_url ||
      data?.thumbnailUrl ||
      data?.author_name ||
      data?.authorName ||
      data?.footer ||
      data?.footer_icon_url ||
      data?.footerIconUrl ||
      (Array.isArray(data?.fields) && data.fields.some((field) => field?.name && field?.value))
  );
}

function buildWelcomeEmbedFromSlot(guild, user, data) {
  const thumbnailUrl = normalizeHttpUrl(data.thumbnail_url || data.thumbnailUrl);
  const imageUrl = normalizeHttpUrl(data.image_url || data.imageUrl);
  const footerIconUrl = normalizeHttpUrl(data.footer_icon_url || data.footerIconUrl);
  const authorIconUrl = normalizeHttpUrl(data.author_icon_url || data.authorIconUrl);
  const embed = new EmbedBuilder();

  if (data.color) {
    embed.setColor(parseColor(data.color) ?? 0x00ff00);
  } else {
    embed.setColor(0x00ff00);
  }

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (thumbnailUrl) {
    embed.setThumbnail(thumbnailUrl);
  }
  if (imageUrl) {
    embed.setImage(imageUrl);
  }
  if (data.footer || data.footer_icon_url || data.footerIconUrl) {
    embed.setFooter({
      text: data.footer || 'Welcome message',
      iconURL: footerIconUrl || undefined
    });
  }
  if (data.author_name || data.authorName) {
    embed.setAuthor({
      name: data.author_name || data.authorName,
      iconURL: authorIconUrl || undefined
    });
  }

  const fields = Array.isArray(data.fields) ? data.fields : [];
  if (fields.length > 0) {
    embed.addFields(
      fields
        .filter((field) => field?.name && field?.value)
        .map((field) => ({
          name: String(field.name),
          value: String(field.value),
          inline: Boolean(field.inline)
        }))
    );
  }

  return embed;
}

export function buildWelcomeEmbeds(guild, user, config) {
  if (config?.welcomeEmbedCleared) {
    return [];
  }

  const firstSlotEmbed = Array.isArray(config.welcomeEmbeds)
    ? config.welcomeEmbeds.find((data) => hasWelcomeEmbedContent(data))
    : null;

  if (firstSlotEmbed) {
    return [buildWelcomeEmbedFromSlot(guild, user, firstSlotEmbed)];
  }

  const hasDirectWelcomeConfig = Boolean(
    config?.title ||
      config?.description ||
      config?.color ||
      config?.imageUrl ||
      config?.thumbnailUrl ||
      config?.footer ||
      config?.footerIconUrl ||
      config?.authorName ||
      config?.authorIconUrl ||
      config?.image_url ||
      config?.thumbnail_url ||
      config?.footer_icon_url ||
      config?.author_name ||
      config?.author_icon_url
  );

  if (hasDirectWelcomeConfig) {
    return [buildWelcomeEmbed(guild, user, config)];
  }

  return [buildWelcomeEmbed(guild, user, config)];
}