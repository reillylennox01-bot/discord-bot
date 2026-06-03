import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';
import { normalizeEmoji, getReactionRolesConfig, setReactionRolesConfig, updateReactionRoleMessage } from '../utils/reactionRoles.js';

function ensureReactionRolesConfig(guildId) {
  const config = getReactionRolesConfig(guildId);
  setReactionRolesConfig(guildId, config);
  return config;
}

export default {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Manage the server reaction role menu')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setchannel')
        .setDescription('Set the channel for the reaction role message')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Text channel for the reaction role menu').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a reaction role option')
        .addRoleOption((option) => option.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption((option) => option.setName('emoji').setDescription('Emoji to react with').setRequired(true))
        .addStringOption((option) => option.setName('label').setDescription('Label shown in the menu'))
        .addStringOption((option) => option.setName('description').setDescription('Description shown in the menu'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a reaction role option')
        .addRoleOption((option) => option.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('Show current reaction role options')
    ),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const reactionRoles = ensureReactionRolesConfig(guildId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Please choose a text channel.', ephemeral: true });
        return;
      }
      reactionRoles.channelId = channel.id;
      reactionRoles.messageId = null;
      setReactionRolesConfig(guildId, reactionRoles);
      await updateReactionRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: `Reaction role menu channel set to ${channel}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      if (!reactionRoles.channelId) {
        await interaction.reply({ content: 'Set a reaction role channel first with `/reactionroles setchannel`.', ephemeral: true });
        return;
      }
      const role = interaction.options.getRole('role');
      const emojiInput = interaction.options.getString('emoji');
      const label = interaction.options.getString('label');
      const description = interaction.options.getString('description');
      const emoji = normalizeEmoji(emojiInput);
      if (!emoji) {
        await interaction.reply({ content: 'Please provide a valid emoji.', ephemeral: true });
        return;
      }
      if (!reactionRoles.roles) reactionRoles.roles = [];
      const existing = reactionRoles.roles.find((item) => item.roleId === role.id || item.emoji === emoji);
      if (existing) {
        await interaction.reply({ content: 'That role or emoji is already configured.', ephemeral: true });
        return;
      }
      reactionRoles.roles.push({ roleId: role.id, emoji, emojiRaw: emojiInput, label, description });
      setReactionRolesConfig(guildId, reactionRoles);
      await updateReactionRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: `Added reaction role ${emojiInput} for ${role.name}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      const index = reactionRoles.roles?.findIndex((item) => item.roleId === role.id);
      if (index === -1 || index === undefined) {
        await interaction.reply({ content: 'That role is not configured for reaction roles.', ephemeral: true });
        return;
      }
      reactionRoles.roles.splice(index, 1);
      setReactionRolesConfig(guildId, reactionRoles);
      await updateReactionRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: `Removed reaction role for ${role.name}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      if (!reactionRoles.roles || reactionRoles.roles.length === 0) {
        await interaction.reply({ content: 'No reaction roles are configured yet.', ephemeral: true });
        return;
      }
      const lines = reactionRoles.roles.map((item) => `${item.emojiRaw || item.emoji} — <@&${item.roleId}>${item.description ? ` — ${item.description}` : ''}`);
      await interaction.reply({ content: `Configured reaction roles:\n${lines.join('\n')}`, ephemeral: true });
      return;
    }
  }
};
