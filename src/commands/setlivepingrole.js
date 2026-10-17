import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setlivepingrole')
    .setDescription('Set or clear the role mentioned in Twitch live alerts')
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Role to mention when the streamer goes live')
    ),
  async execute(interaction) {
    const role = interaction.options.getRole('role');

    setGuildConfig(interaction.guild.id, {
      twitchNotifyRoleId: role?.id ?? null
    });

    await interaction.reply({
      content: role
        ? `${role} will be mentioned when the streamer goes live.`
        : 'The Twitch live-alert role mention has been cleared.',
      flags: MessageFlags.Ephemeral
    });
  }
};