import { ChannelType } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';
import { buildWelcomeEmbeds } from '../utils/welcomeEmbed.js';

const recentWelcomeJoins = new Map();

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const now = Date.now();
    const lastJoinAt = recentWelcomeJoins.get(member.id);

    if (lastJoinAt && now - lastJoinAt < 15000) {
      return;
    }

    recentWelcomeJoins.set(member.id, now);
    setTimeout(() => recentWelcomeJoins.delete(member.id), 20000);

    const config = getGuildConfig(member.guild.id);
    if (!config.welcomeChannelId) {
      return;
    }

    let welcomeChannel = null;

    try {
      welcomeChannel = await member.guild.channels.fetch(config.welcomeChannelId);
    } catch (error) {
      welcomeChannel = null;
    }

    if (!welcomeChannel || welcomeChannel.type !== ChannelType.GuildText) {
      return;
    }

    const embeds = buildWelcomeEmbeds(member.guild, member.user, config);
    if (embeds.length === 0) {
      return;
    }

    if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
      await welcomeChannel.send({
        content: `<@${member.id}>`,
        embeds,
        allowedMentions: { users: [member.id] }
      }).catch(() => null);
    }

    if (config.sendDM) {
      await member.send({ embeds }).catch(() => null);
    }
  }
};
