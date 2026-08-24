import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set the channel where welcome messages are sent.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The text channel for welcome messages')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel');
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: 'Please choose a text channel for welcome messages.' });
      return;
    }

    setGuildConfig(interaction.guild.id, { welcomeChannelId: channel.id });
    await interaction.editReply({ content: `Welcome messages will now be sent to ${channel}.` });
  }
};
