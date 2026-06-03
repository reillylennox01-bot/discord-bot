import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getModerationHistory } from '../utils/modLogs.js';

export default {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('View a member\'s moderation history using their user ID.')
    .addStringOption((option) =>
      option.setName('user_id').setDescription('The Discord user ID to lookup').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('How many recent entries to show (max 10)')
        .setMinValue(1)
        .setMaxValue(10)
    ),
  requiredPermissions:
    PermissionFlagsBits.KickMembers |
    PermissionFlagsBits.BanMembers |
    PermissionFlagsBits.ModerateMembers |
    PermissionFlagsBits.ManageMessages,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString('user_id');
    const limit = interaction.options.getInteger('limit') ?? 10;

    if (!/^[0-9]{17,20}$/.test(userId)) {
      await interaction.editReply({ content: 'Please provide a valid Discord user ID.' });
      return;
    }

    const history = getModerationHistory(interaction.guild.id, userId);
    if (!history.length) {
      await interaction.editReply({ content: `No moderation history found for <@${userId}>.` });
      return;
    }

    const targetTag = history[history.length - 1]?.targetTag || userId;
    const entries = history.slice(-limit).reverse();
    const embed = new EmbedBuilder()
      .setTitle(`Moderation history for ${targetTag}`)
      .setDescription(`Showing ${entries.length} of ${history.length} recorded actions.`)
      .setColor(0xffa500)
      .setTimestamp();

    for (const entry of entries) {
      embed.addFields({
        name: `${entry.action} • ${new Date(entry.timestamp).toLocaleString()}`,
        value: `Moderator: <@${entry.moderatorId}>
Reason: ${entry.reason}
Extra: ${entry.extra || 'None'}`,
        inline: false
      });
    }

    if (history.length > entries.length) {
      embed.addFields({ name: 'More', value: `${history.length - entries.length} more entries not shown.`, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
