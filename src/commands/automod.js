import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { getModerationConfig, setModerationConfig } from '../utils/moderation.js';

export default {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure automatic moderation filters')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable')
        .setDescription('Enable automatic moderation')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Disable automatic moderation')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('addword')
        .setDescription('Block a specific word or phrase')
        .addStringOption((option) =>
          option.setName('word').setDescription('Word or phrase to block').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('removeword')
        .setDescription('Remove a blocked word or phrase')
        .addStringOption((option) =>
          option.setName('word').setDescription('Word or phrase to remove').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('addlink')
        .setDescription('Block a specific link or domain substring')
        .addStringOption((option) =>
          option.setName('link').setDescription('Link, domain, or keyword to block').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('removelink')
        .setDescription('Remove a blocked link or domain')
        .addStringOption((option) =>
          option.setName('link').setDescription('Link, domain, or keyword to remove').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('togglelinks')
        .setDescription('Enable or disable blocking of all links')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Block all links if true').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setlogchannel')
        .setDescription('Set the moderation log channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to send automod logs').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Show the current automod configuration')
    ),
  requiredPermissions: PermissionFlagsBits.ManageGuild,
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = getModerationConfig(guildId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'enable') {
      config.enabled = true;
      setModerationConfig(guildId, config);
      await interaction.reply({ content: 'AutoMod has been enabled.', ephemeral: true });
      return;
    }

    if (subcommand === 'disable') {
      config.enabled = false;
      setModerationConfig(guildId, config);
      await interaction.reply({ content: 'AutoMod has been disabled.', ephemeral: true });
      return;
    }

    if (subcommand === 'addword') {
      const word = interaction.options.getString('word').trim();
      if (config.blockedWords.includes(word.toLowerCase())) {
        await interaction.reply({ content: 'That word is already blocked.', ephemeral: true });
        return;
      }
      config.blockedWords.push(word);
      setModerationConfig(guildId, config);
      await interaction.reply({ content: `Added blocked word: ${word}`, ephemeral: true });
      return;
    }

    if (subcommand === 'removeword') {
      const word = interaction.options.getString('word').trim();
      const index = config.blockedWords.findIndex((item) => item.toLowerCase() === word.toLowerCase());
      if (index === -1) {
        await interaction.reply({ content: 'That word is not in the blocked list.', ephemeral: true });
        return;
      }
      config.blockedWords.splice(index, 1);
      setModerationConfig(guildId, config);
      await interaction.reply({ content: `Removed blocked word: ${word}`, ephemeral: true });
      return;
    }

    if (subcommand === 'addlink') {
      const link = interaction.options.getString('link').trim();
      if (config.blockedLinks.includes(link.toLowerCase())) {
        await interaction.reply({ content: 'That link pattern is already blocked.', ephemeral: true });
        return;
      }
      config.blockedLinks.push(link);
      setModerationConfig(guildId, config);
      await interaction.reply({ content: `Added blocked link pattern: ${link}`, ephemeral: true });
      return;
    }

    if (subcommand === 'removelink') {
      const link = interaction.options.getString('link').trim();
      const index = config.blockedLinks.findIndex((item) => item.toLowerCase() === link.toLowerCase());
      if (index === -1) {
        await interaction.reply({ content: 'That link pattern is not configured.', ephemeral: true });
        return;
      }
      config.blockedLinks.splice(index, 1);
      setModerationConfig(guildId, config);
      await interaction.reply({ content: `Removed blocked link pattern: ${link}`, ephemeral: true });
      return;
    }

    if (subcommand === 'togglelinks') {
      const enabled = interaction.options.getBoolean('enabled');
      config.blockLinks = enabled;
      setModerationConfig(guildId, config);
      await interaction.reply({ content: `Block all links is now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'setlogchannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Please choose a text channel.', ephemeral: true });
        return;
      }
      config.logChannelId = channel.id;
      setModerationConfig(guildId, config);
      await interaction.reply({ content: `Moderation log channel set to ${channel}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      const lines = [
        `Enabled: ${config.enabled}`,
        `Block all links: ${config.blockLinks}`,
        `Blocked words: ${config.blockedWords.length > 0 ? config.blockedWords.join(', ') : 'None'}`,
        `Blocked link patterns: ${config.blockedLinks.length > 0 ? config.blockedLinks.join(', ') : 'None'}`,
        `Log channel: ${config.logChannelId ? `<#${config.logChannelId}>` : 'None'}`
      ];
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }
  }
};
