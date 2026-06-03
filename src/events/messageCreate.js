import { getModerationConfig, containsBlockedWord, containsLink, containsBlockedLinkPattern, buildModerationLogEmbed } from '../utils/moderation.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild || !message.member) return;

    const config = getModerationConfig(message.guild.id);
    if (!config.enabled) return;

    if (message.member.permissions.has('ManageMessages') || message.member.permissions.has('Administrator') || message.member.permissions.has('ManageGuild')) {
      return;
    }

    const content = message.content || '';
    const blockedWord = containsBlockedWord(content, config.blockedWords);
    const hasLink = config.blockLinks ? containsLink(content) : false;
    const blockedLink = containsBlockedLinkPattern(content, config.blockedLinks);

    let reason = null;
    let match = null;
    if (blockedWord) {
      reason = 'blocked word';
      match = blockedWord;
    } else if (hasLink) {
      reason = 'link blocking';
      match = 'Generic blocked link detected';
    } else if (blockedLink) {
      reason = 'blocked link pattern';
      match = blockedLink;
    }

    if (!reason) return;

    await message.delete().catch(() => null);

    try {
      await message.author.send(`Your message in ${message.guild.name} was removed by AutoMod because it contained blocked content (${match}). Please follow the server rules.`);
    } catch {
      // ignore DM failures
    }

    if (config.logChannelId) {
      const logChannel = await message.guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const embed = buildModerationLogEmbed(message, reason, match);
        await logChannel.send({ embeds: [embed] }).catch(() => null);
      }
    }
  }
};
