import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

function normalizeCommandName(name) {
  return name?.trim().toLowerCase();
}

function getRestrictedCommands(client) {
  return Array.from(client.commands.values())
    .filter((command) => command.requiredPermissions && command.data?.name)
    .map((command) => command.data.name)
    .sort();
}

export default {
  data: new SlashCommandBuilder()
    .setName('commandaccess')
    .setDescription('Manage which restricted commands members may use')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('Show currently allowed member commands')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('available')
        .setDescription('Show restricted commands that can be allowed for members')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('allow')
        .setDescription('Allow members to use a restricted command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The restricted command name to allow')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('revoke')
        .setDescription('Remove member access for a restricted command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The restricted command name to revoke from members')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('denyrole')
        .setDescription('Deny a restricted command for a specific role')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The restricted command name to deny for the role')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to deny from using the command')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('allowrole')
        .setDescription('Allow a previously denied role to use a restricted command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The restricted command name to allow for the role')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to allow for the command')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rolelist')
        .setDescription('Show role-based denied commands')
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const guildConfig = getGuildConfig(guildId);
    const allowedCommands = guildConfig.allowedCommands || [];
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      if (!allowedCommands.length) {
        await interaction.reply({ content: 'No restricted commands are currently allowed for members.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Allowed member commands:\n${allowedCommands.map((cmd) => `- \`${cmd}\``).join('\n')}`, ephemeral: true });
      return;
    }

    const restrictedCommands = getRestrictedCommands(interaction.client);

    if (subcommand === 'available') {
      await interaction.reply({ content: `Restricted commands that can be allowed for members:\n- ${restrictedCommands.join('\n- ') || 'None'}`, ephemeral: true });
      return;
    }

    if (subcommand === 'rolelist') {
      const deniedByCommand = guildConfig.commandRoleDeny || {};
      const lines = restrictedCommands.map((cmd) => {
        const roleIds = deniedByCommand[cmd] || [];
        return `/${cmd}: ${roleIds.length ? roleIds.map((roleId) => `<@&${roleId}>`).join(', ') : 'None'}`;
      });
      await interaction.reply({ content: `Role-based denied commands:\n${lines.join('\n')}`, ephemeral: true });
      return;
    }

    const commandInput = normalizeCommandName(interaction.options.getString('command'));
    const commandObject = interaction.client.commands.get(commandInput);
    if (!commandObject || !commandObject.requiredPermissions) {
      await interaction.reply({ content: `That command is not a configurable restricted command. Valid choices are: ${restrictedCommands.join(', ')}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'allow') {
      if (allowedCommands.includes(commandInput)) {
        await interaction.reply({ content: `Members already have access to \`${commandInput}\`.`, ephemeral: true });
        return;
      }
      setGuildConfig(guildId, { allowedCommands: [...allowedCommands, commandInput] });
      await interaction.reply({ content: `Members may now use the restricted command \`${commandInput}\`.`, ephemeral: true });
      return;
    }

    if (subcommand === 'revoke') {
      if (!allowedCommands.includes(commandInput)) {
        await interaction.reply({ content: `Members do not currently have access to \`${commandInput}\`.`, ephemeral: true });
        return;
      }
      setGuildConfig(guildId, { allowedCommands: allowedCommands.filter((cmd) => cmd !== commandInput) });
      await interaction.reply({ content: `Member access to \`${commandInput}\` has been revoked.`, ephemeral: true });
      return;
    }

    if (subcommand === 'denyrole' || subcommand === 'allowrole') {
      const role = interaction.options.getRole('role');
      const deniedByCommand = { ...(guildConfig.commandRoleDeny || {}) };
      const currentRoles = new Set(deniedByCommand[commandInput] || []);

      if (subcommand === 'denyrole') {
        if (currentRoles.has(role.id)) {
          await interaction.reply({ content: `${role} is already denied from using \`${commandInput}\`.`, ephemeral: true });
          return;
        }
        currentRoles.add(role.id);
        deniedByCommand[commandInput] = [...currentRoles];
        setGuildConfig(guildId, { commandRoleDeny: deniedByCommand });
        await interaction.reply({ content: `${role} is now denied from using \`${commandInput}\`.`, ephemeral: true });
        return;
      }

      if (!currentRoles.has(role.id)) {
        await interaction.reply({ content: `${role} is not denied from using \`${commandInput}\`.`, ephemeral: true });
        return;
      }
      currentRoles.delete(role.id);
      deniedByCommand[commandInput] = [...currentRoles];
      setGuildConfig(guildId, { commandRoleDeny: deniedByCommand });
      await interaction.reply({ content: `${role} may now use \`${commandInput}\` again.`, ephemeral: true });
      return;
    }
  }
};
