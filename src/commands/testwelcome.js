import { SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';
import { buildWelcomeEmbeds } from '../utils/welcomeEmbed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testwelcome')
    .setDescription('Test the welcome message (Raven Guard only)'),
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if user has the required role
      const requiredRoleId = '1507804900728508527';
      const member = interaction.member;
      const hasRequiredRole = Boolean(
        member?.roles?.cache?.has(requiredRoleId) ||
        member?.roles?.some?.((role) => role === requiredRoleId)
      );

      if (!hasRequiredRole) {
        await interaction.editReply({
          content: 'You do not have permission to use this command.'
        });
        return;
      }

      const config = getGuildConfig(interaction.guild.id);
      const embeds = buildWelcomeEmbeds(interaction.guild, interaction.user, config);

      await interaction.editReply({
        embeds,
        content: 'Here is how the welcome message will look:'
      });
    } catch (error) {
      console.error('Error in testwelcome command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'There was an error executing this command. Please check the console for details.'
        });
      } else {
        await interaction.reply({
          content: 'There was an error executing this command. Please check the console for details.',
          ephemeral: true
        });
      }
    }
  }
};
