import { getReactionRolesConfig, findReactionRole } from '../utils/reactionRoles.js';

export default {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }
    const message = reaction.message;
    if (!message.guild) return;

    const reactionRoles = getReactionRolesConfig(message.guild.id);
    if (!reactionRoles || message.id !== reactionRoles.messageId) return;

    const mapping = findReactionRole(reactionRoles, reaction);
    if (!mapping) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;
    await member.roles.add(mapping.roleId).catch(() => null);
  }
};
