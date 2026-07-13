import { ChannelType } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';
import { buildWelcomeEmbeds } from '../utils/welcomeEmbed.js';

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

    const embeds = buildWelcomeEmbeds(member.guild, member.user, config);

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
