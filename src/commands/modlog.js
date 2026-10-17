import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getModerationHistory } from '../utils/modLogs.js';
import { hasWatchlistAccess } from '../utils/watchlistAccess.js';

const HISTORY_PAGE_SIZE = 10;

function truncate(value, maxLength) {
  const text = String(value || 'None');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export default {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('View a member\'s moderation history using their user ID.')
    .addStringOption((option) =>
      option.setName('user_id').setDescription('The Discord user ID to lookup').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('History page to view')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!hasWatchlistAccess(member)) {
      await interaction.editReply({ content: 'You need an authorized watch-list staff role to view moderation history.' });
      return;
    }

    const userId = interaction.options.getString('user_id');
    const page = interaction.options.getInteger('page') ?? 1;

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
    const newestFirst = history.slice().reverse();
    const pageCount = Math.ceil(newestFirst.length / HISTORY_PAGE_SIZE);
    if (page > pageCount) {
      await interaction.editReply({ content: `That page does not exist. This member has ${pageCount} page${pageCount === 1 ? '' : 's'} of moderation history.` });
      return;
    }

    const startIndex = (page - 1) * HISTORY_PAGE_SIZE;
    const entries = newestFirst.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
    const embed = new EmbedBuilder()
      .setTitle(`Moderation history for ${targetTag}`)
      .setDescription(`Showing records ${startIndex + 1}-${startIndex + entries.length} of ${history.length}.`)
      .setColor(0xffa500)
      .setFooter({ text: `Page ${page} of ${pageCount}` })
      .setTimestamp();

    for (const entry of entries) {
      const timestamp = new Date(entry.timestamp);
      embed.addFields({
        name: `${truncate(entry.action, 100)} • ${Number.isNaN(timestamp.getTime()) ? 'Unknown date' : timestamp.toLocaleString()}`,
        value: `Moderator: ${entry.moderatorId ? `<@${entry.moderatorId}>` : 'Unknown'}\nReason: ${truncate(entry.reason, 220)}\nDetails: ${truncate(entry.extra, 120)}`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
