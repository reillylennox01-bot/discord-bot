import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clearwelcome')
    .setDescription('Clear the saved welcome embed configuration'),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: 'You need Administrator permission to clear the welcome message.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    setGuildConfig(interaction.guild.id, {
      title: null,
      description: null,
      color: null,
      imageUrl: null,
      thumbnailUrl: null,
      footer: null,
      footerIconUrl: null,
      authorName: null,
      authorIconUrl: null,
      welcomeEmbeds: [],
      welcomeEmbedCleared: true
    });

    await interaction.editReply({
      content: 'Welcome embed cleared. The welcome channel and existing messages were left unchanged.'
    });
  }
};
