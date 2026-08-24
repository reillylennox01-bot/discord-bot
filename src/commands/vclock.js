import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const LOST_SOUS_ROLE_ID = '1508162960072118272';

export default {
  data: new SlashCommandBuilder()
    .setName('vclock')
    .setDescription('Lock or limit a voice channel. Requires the Lost Sous role.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Voice channel to manage')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Set the max number of people who can join (0 = unlimited)')
        .setMinValue(0)
        .setMaxValue(99)
    )
    .addBooleanOption((option) =>
      option
        .setName('lock')
        .setDescription('Deny @everyone access to this channel so only the Lost Sous role can join')
    )
    .addBooleanOption((option) =>
      option
        .setName('unlock')
        .setDescription('Remove the lock and restore normal join access')
    ),

  async execute(interaction) {
    const hasLostSousRole = interaction.member?.roles?.cache?.has(LOST_SOUS_ROLE_ID);
    if (!hasLostSousRole) {
      await interaction.reply({
        content: 'This command is only available to members with the configured Lost Sous role.',
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const limit = interaction.options.getInteger('limit');
    const lock = interaction.options.get('lock')?.value ?? false;
    const unlock = interaction.options.get('unlock')?.value ?? false;

    if (!channel || !channel.isVoiceBased()) {
      await interaction.reply({
        content: 'Please choose a valid voice channel.',
        ephemeral: true
      });
      return;
    }

    const botCanManageChannels = interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageChannels) ?? false;
    if (!botCanManageChannels) {
      await interaction.reply({
        content: 'I need the Manage Channels permission in this server before I can lock a voice channel.',
        ephemeral: true
      });
      return;
    }

    if (lock && unlock) {
      await interaction.reply({
        content: 'Choose either `lock` or `unlock`, not both.',
        ephemeral: true
      });
      return;
    }

    const lostSousRole = interaction.guild.roles.cache.get(LOST_SOUS_ROLE_ID);
    if ((lock || unlock) && !lostSousRole) {
      await interaction.reply({
        content: 'I could not find the configured Lost Sous role in this server, so I cannot safely apply the lock.',
        ephemeral: true
      });
      return;
    }

    const updates = [];

    if (limit !== null) {
      updates.push(channel.setUserLimit(limit));
    }

    if (lock) {
      updates.push(
        channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          Connect: false,
          Speak: false,
          Stream: false
        }),
        channel.permissionOverwrites.edit(lostSousRole, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          UseVAD: true,
          Stream: true
        })
      );
    }

    if (unlock) {
      updates.push(
        channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          Connect: null,
          Speak: null,
          Stream: null
        }),
        channel.permissionOverwrites.edit(lostSousRole, {
          ViewChannel: null,
          Connect: null,
          Speak: null,
          UseVAD: null,
          Stream: null
        })
      );
    }

    try {
      await Promise.all(updates);

      const parts = [];
      if (limit !== null) {
        parts.push(`user limit set to ${limit === 0 ? 'unlimited' : limit}`);
      }
      if (lock) {
        parts.push('channel locked for @everyone');
      }
      if (unlock) {
        parts.push('lock removed');
      }

      await interaction.reply({
        content: `✅ Updated ${channel}. ${parts.length ? parts.join(' · ') : 'No channel changes were needed.'}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Voice channel lock update failed:', error);
      await interaction.reply({
        content: 'I could not update that voice channel. Check my permissions and try again.',
        ephemeral: true
      });
    }
  }
};
