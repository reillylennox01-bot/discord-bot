import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import { sendSpookyMemeToChannel } from '../spookyMemeScheduler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testspookymeme')
    .setDescription('Send the 3AM meme immediately for testing')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Optional text channel to send the test meme to')
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const selectedChannel = interaction.options.getChannel('channel');
    const targetChannel = selectedChannel || interaction.channel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: 'Please run this command in a text channel or choose one with the channel option.'
      });
      return;
    }

    const sent = await sendSpookyMemeToChannel(targetChannel);
    if (!sent) {
      await interaction.editReply({
        content: 'Failed to send the test meme. Check the bot permissions for that channel.'
      });
      return;
    }

    await interaction.editReply({
      content: `Test meme sent to ${targetChannel}.`
    });
  }
};