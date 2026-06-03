import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('twitchsubrole')
    .setDescription('Set the Discord role to assign to linked Twitch subscribers.')
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('The role to assign to subscribers')
        .setRequired(true)
    ),
  requiredPermissions: PermissionFlagsBits.ManageRoles,

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const config = getGuildConfig(interaction.guild.id);
    setGuildConfig(interaction.guild.id, {
      twitchSubRoleId: role.id,
      twitchLinkedAccounts: config.twitchLinkedAccounts || {}
    });

    await interaction.reply({
      content: `Twitch subscriber role has been set to ${role}.`,
      ephemeral: true
    });
  }
};
