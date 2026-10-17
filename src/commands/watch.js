import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } from 'discord.js';
import { addModerationLog } from '../utils/modLogs.js';
import { hasWatchlistAccess } from '../utils/watchlistAccess.js';

const WATCHLIST_CHANNEL_ID = '1561014134160625746';

export default {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription('Add a user to the watch list with a reason')
    .addStringOption((option) =>
      option
        .setName('user_id')
        .setDescription('Discord user ID to add to the watch list')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for adding this user to the watch list')
        .setMaxLength(1000)
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!hasWatchlistAccess(member)) {
      await interaction.editReply({ content: 'You need an authorized watch-list staff role to use this command.' });
      return;
    }

    const userId = interaction.options.getString('user_id').trim();
    const reason = interaction.options.getString('reason').trim();
    if (!/^[0-9]{17,20}$/.test(userId)) {
      await interaction.editReply({ content: 'Please provide a valid Discord user ID.' });
      return;
    }
    if (!reason) {
      await interaction.editReply({ content: 'Please provide a reason for adding this user to the watch list.' });
      return;
    }

    const watchlistChannel = await interaction.guild.channels.fetch(WATCHLIST_CHANNEL_ID).catch(() => null);
    if (!watchlistChannel || watchlistChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: 'I could not access the configured watch-list channel.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('User Added to Watch List')
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'User ID', value: userId, inline: true },
        { name: 'Added by', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    try {
      await watchlistChannel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error('Failed to post watch-list entry:', error);
      await interaction.editReply({ content: 'I could not send the watch-list entry. Check my channel permissions.' });
      return;
    }

    addModerationLog(interaction.guild.id, {
      action: 'Watch',
      targetId: userId,
      targetTag: userId,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
      extra: `Added to watch list channel ${watchlistChannel.name}`,
      timestamp: new Date().toISOString()
    });

    await interaction.editReply({ content: `Added user ID ${userId} to the watch list.` });
  }
};