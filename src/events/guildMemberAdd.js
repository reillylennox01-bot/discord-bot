import { EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return parseInt(normalized, 16);
}

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = getGuildConfig(member.guild.id);
    let welcomeChannel = null;

    if (config.welcomeChannelId) {
      try {
        welcomeChannel = await member.guild.channels.fetch(config.welcomeChannelId);
      } catch (error) {
        welcomeChannel = null;
      }
    }

    if (!welcomeChannel || welcomeChannel.type !== ChannelType.GuildText) {
      welcomeChannel =
        member.guild.channels.cache.find(
          (channel) => channel.name === 'welcome' && channel.type === ChannelType.GuildText
        ) || member.guild.systemChannel;
    }

    const embed = new EmbedBuilder()
      .setColor(parseColor(config.color) ?? 0x00ff00)
      .setTitle(config.title || `Welcome to ${member.guild.name}!`)
      .setDescription(
        config.description || `Hello ${member.user}, welcome to **${member.guild.name}**! We're happy to have you here.`
      )
      .setThumbnail(
        config.thumbnailUrl || member.user.displayAvatarURL({ extension: 'png', size: 512 })
      )
      .addFields(
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
        { name: 'Get Started', value: 'Read the rules and say hello in chat!', inline: true }
      )
      .setFooter({ text: config.footer || 'Welcome message', iconURL: config.footerIconUrl ?? undefined })
      .setTimestamp();

    if (config.imageUrl) {
      embed.setImage(config.imageUrl);
    }

    if (config.authorName) {
      embed.setAuthor({ name: config.authorName, iconURL: config.authorIconUrl ?? undefined });
    }

    if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
      await welcomeChannel.send({ embeds: [embed] }).catch(() => null);
    }

    if (config.sendDM) {
      await member.send({ embeds: [embed] }).catch(() => null);
    }
  }
};
