import { SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';
import { assignRoleIfSubscribed } from '../twitchLive.js';

export default {
  data: new SlashCommandBuilder()
    .setName('twitchlink')
    .setDescription('Manage Twitch account linking for subscriber role assignment.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('link')
        .setDescription('Link your Twitch username to your Discord account.')
        .addStringOption((option) =>
          option.setName('username').setDescription('Your Twitch username').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View your linked Twitch username and subscriber role status.')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const config = getGuildConfig(interaction.guild.id);
    const linkedAccounts = config.twitchLinkedAccounts || {};

    if (subcommand === 'link') {
      const username = interaction.options.getString('username').trim().toLowerCase();
      if (!/^[a-z0-9_]{4,25}$/.test(username)) {
        await interaction.reply({ content: 'Please provide a valid Twitch username.', ephemeral: true });
        return;
      }

      linkedAccounts[username] = interaction.user.id;
      setGuildConfig(interaction.guild.id, { twitchLinkedAccounts: linkedAccounts });

      let message = `Linked Twitch user **${username}** to your Discord account.`;
      try {
        const assignResult = await assignRoleIfSubscribed(interaction.guild, username, interaction.user.id);
        if (assignResult.success && assignResult.reason === 'roleAssigned') {
          message += ' You are subscribed right now, so your subscriber role has been assigned.';
        } else if (assignResult.success && assignResult.reason === 'alreadyHasRole') {
          message += ' You are subscribed and already have the subscriber role.';
        } else if (assignResult.reason === 'notSubscribed') {
          message += ' You are not currently detected as subscribed. If you are a subscriber, it may still assign on the next check.';
        } else if (assignResult.reason === 'notConfigured') {
          message += ' Subscriber role assignment is not configured yet. Have an admin set /twitchsubrole.';
        } else if (assignResult.reason === 'streamerNotFound') {
          message += ' The configured streamer could not be found on Twitch.';
        } else if (assignResult.reason === 'roleNotFound') {
          message += ' The configured subscriber role could not be found in this server.';
        } else if (assignResult.reason === 'memberNotFound') {
          message += ' I could not find your server member record.';
        } else if (assignResult.reason === 'apiError') {
          message += ' I could not verify your subscription status right now, but the link is still saved.';
        } else if (assignResult.reason === 'roleAssignFailed') {
          message += ' Your Twitch account is subscribed, but I failed to assign the role. Check my role permissions.';
        }
      } catch (error) {
        console.error('twitchlink assign role check failed:', error);
      }

      message += ' If you are subscribed, your role will still be assigned on the next scheduled check.';
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    if (subcommand === 'status') {
      const matched = Object.entries(linkedAccounts).find(([, discordId]) => discordId === interaction.user.id);
      if (!matched) {
        await interaction.reply({ content: 'You do not have a Twitch account linked yet. Use `/twitchlink link username`.', ephemeral: true });
        return;
      }

      const [username] = matched;
      const roleId = config.twitchSubRoleId;
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const hasRole = roleId && member?.roles?.cache?.has(roleId);
      const roleLabel = roleId ? `<@&${roleId}>` : 'not configured';

      let message = `Your linked Twitch username is **${username}**.\nSubscriber role: ${roleLabel}.\n`;
      message += hasRole ? 'You currently have the subscriber role.' : "You don't currently have the subscriber role.";
      if (!config.twitchSubRoleId) {
        message += ' Ask an admin to set the subscriber role with /twitchsubrole.';
      }
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }
  }
};
