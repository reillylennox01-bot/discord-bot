import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';
import { addModerationLog } from '../utils/modLogs.js';

function parseDuration(value) {
  if (!value) return null;
  const match = value.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

function buildLogEmbed(action, moderator, target, reason, extra = '') {
  return new EmbedBuilder()
    .setTitle('Moderation Action')
    .setColor(0xff0000)
    .addFields(
      { name: 'Action', value: action, inline: true },
      { name: 'Target', value: `<@${target.id}>`, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Reason', value: reason, inline: false },
      { name: 'Extra', value: extra || 'None', inline: false }
    )
    .setTimestamp();
}

function getModerationLogChannelId(guildId) {
  const config = getGuildConfig(guildId);
  return config.moderation?.logChannelId || config.automod?.logChannelId || null;
}

async function sendModerationLog(interaction, action, target, reason, extra = '') {
  const logChannelId = getModerationLogChannelId(interaction.guild.id);
  if (!logChannelId) return;

  const channel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = buildLogEmbed(action, interaction.member.user, target, reason, extra);
  await channel.send({ embeds: [embed] }).catch(() => null);
}

export default {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Moderation actions: kick, ban, mute, unmute, warn, and log channel setup.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption((option) =>
          option.setName('target').setDescription('The member to kick').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the kick')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption((option) =>
          option.setName('target').setDescription('The member to ban').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the ban')
        )
        .addIntegerOption((option) =>
          option
            .setName('delete_days')
            .setDescription('Number of days of messages to delete (0-7)')
            .setMinValue(0)
            .setMaxValue(7)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('mute')
        .setDescription('Temporarily timeout a member')
        .addUserOption((option) =>
          option.setName('target').setDescription('The member to mute').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('duration').setDescription('Mute duration like 10m, 1h, 1d').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the mute')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unmute')
        .setDescription('Remove timeout from a member')
        .addUserOption((option) =>
          option.setName('target').setDescription('The member to unmute').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the unmute')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('warn')
        .setDescription('Warn a member and log the warning')
        .addUserOption((option) =>
          option.setName('target').setDescription('The member to warn').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the warning')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setlog')
        .setDescription('Set the channel where moderation actions are logged')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to send moderation logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clearlog')
        .setDescription('Clear the moderation log channel')
    ),
  requiredPermissions:
    PermissionFlagsBits.KickMembers |
    PermissionFlagsBits.BanMembers |
    PermissionFlagsBits.ModerateMembers |
    PermissionFlagsBits.ManageMessages,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const actor = interaction.member;
    const moderationConfig = getGuildConfig(interaction.guild.id).moderation || {};
    const isConfigCommand = subcommand === 'setlog' || subcommand === 'clearlog';

    await interaction.deferReply({ ephemeral: isConfigCommand });

    if (subcommand === 'setlog') {
      const channel = interaction.options.getChannel('channel');
      setGuildConfig(interaction.guild.id, {
        moderation: {
          ...moderationConfig,
          logChannelId: channel.id
        }
      });
      await interaction.editReply({ content: `Moderation logs will now be sent to ${channel}.` });
      return;
    }

    if (subcommand === 'clearlog') {
      setGuildConfig(interaction.guild.id, {
        moderation: {
          ...moderationConfig,
          logChannelId: null
        }
      });
      await interaction.editReply({ content: 'Moderation log channel has been cleared.' });
      return;
    }

    const targetUser = interaction.options.getUser('target');
    if (!targetUser) {
      await interaction.editReply({ content: 'You must choose a member to moderate.' });
      return;
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await interaction.editReply({ content: 'I could not find that member in this server.' });
      return;
    }

    if (targetMember.id === interaction.client.user.id) {
      await interaction.editReply({ content: 'I cannot moderate myself.' });
      return;
    }

    if (targetMember.id === actor.id) {
      await interaction.editReply({ content: 'You cannot moderate yourself.' });
      return;
    }

    if (!targetMember.moderatable) {
      await interaction.editReply({ content: 'I do not have permission to moderate that member.' });
      return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided.';
    const logTarget = targetUser;
    const dmMessage = `You have been ${subcommand}ed in ${interaction.guild.name}. Reason: ${reason}`;
    await targetMember.send(dmMessage).catch(() => null);

    if (subcommand === 'kick') {
      await targetMember.kick(reason);
      addModerationLog(interaction.guild.id, {
        action: 'Kick',
        targetId: targetMember.id,
        targetTag: targetMember.user.tag,
        moderatorId: actor.id,
        moderatorTag: actor.user.tag,
        reason,
        extra: '',
        timestamp: new Date().toISOString()
      });
      await interaction.editReply({ content: `Kicked <@${targetMember.id}>. Reason: ${reason}` });
      await sendModerationLog(interaction, 'Kick', logTarget, reason);
      return;
    }

    if (subcommand === 'ban') {
      const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
      await interaction.guild.bans.create(targetMember.id, {
        deleteMessageSeconds: deleteDays * 86400,
        reason
      });
      addModerationLog(interaction.guild.id, {
        action: 'Ban',
        targetId: targetMember.id,
        targetTag: targetMember.user.tag,
        moderatorId: actor.id,
        moderatorTag: actor.user.tag,
        reason,
        extra: `Deleted messages: ${deleteDays} days`,
        timestamp: new Date().toISOString()
      });
      await interaction.editReply({ content: `Banned <@${targetMember.id}>. Reason: ${reason}` });
      await sendModerationLog(interaction, 'Ban', logTarget, reason, `Delete messages for ${deleteDays} days`);
      return;
    }

    if (subcommand === 'mute') {
      const duration = interaction.options.getString('duration');
      const timeoutMs = parseDuration(duration);
      if (!timeoutMs || timeoutMs < 1000) {
        await interaction.editReply({ content: 'Please provide a valid duration like `10m`, `1h`, or `1d`.' });
        return;
      }
      await targetMember.timeout(timeoutMs, reason);
      addModerationLog(interaction.guild.id, {
        action: 'Mute',
        targetId: targetMember.id,
        targetTag: targetMember.user.tag,
        moderatorId: actor.id,
        moderatorTag: actor.user.tag,
        reason,
        extra: `Duration: ${duration}`,
        timestamp: new Date().toISOString()
      });
      await interaction.editReply({ content: `Muted <@${targetMember.id}> for ${duration}. Reason: ${reason}` });
      await sendModerationLog(interaction, 'Mute', logTarget, reason, `Duration: ${duration}`);
      return;
    }

    if (subcommand === 'unmute') {
      await targetMember.timeout(null, reason);
      addModerationLog(interaction.guild.id, {
        action: 'Unmute',
        targetId: targetMember.id,
        targetTag: targetMember.user.tag,
        moderatorId: actor.id,
        moderatorTag: actor.user.tag,
        reason,
        extra: '',
        timestamp: new Date().toISOString()
      });
      await interaction.editReply({ content: `Unmuted <@${targetMember.id}>. Reason: ${reason}` });
      await sendModerationLog(interaction, 'Unmute', logTarget, reason);
      return;
    }

    if (subcommand === 'warn') {
      addModerationLog(interaction.guild.id, {
        action: 'Warn',
        targetId: targetMember.id,
        targetTag: targetMember.user.tag,
        moderatorId: actor.id,
        moderatorTag: actor.user.tag,
        reason,
        extra: '',
        timestamp: new Date().toISOString()
      });
      await interaction.editReply({ content: `Warned <@${targetMember.id}>. Reason: ${reason}` });
      await sendModerationLog(interaction, 'Warn', logTarget, reason);
      return;
    }

    await interaction.reply({ content: 'Unknown moderation command.', ephemeral: true });
  }
};
