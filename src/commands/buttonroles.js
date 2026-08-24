import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { getButtonRolesConfig, setButtonRolesConfig, updateButtonRoleMessage } from '../utils/buttonRoles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('buttonroles')
    .setDescription('Manage button-based self-assign roles')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setchannel')
        .setDescription('Set the channel for the button role message')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Text channel for the button role menu').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a button role option')
        .addRoleOption((option) => option.setName('role').setDescription('Role to assign/remove').setRequired(true))
        .addStringOption((option) => option.setName('label').setDescription('Button label'))
        .addStringOption((option) => option.setName('description').setDescription('Description shown in the embed'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a button role option')
        .addRoleOption((option) => option.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('Show current button role options')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setembed')
        .setDescription('Configure the button role embed appearance')
        .addStringOption((option) => option.setName('title').setDescription('Embed title'))
        .addStringOption((option) => option.setName('description').setDescription('Embed description'))
        .addStringOption((option) => option.setName('color').setDescription('Embed color as hex, e.g. #5865f2'))
        .addStringOption((option) => option.setName('image_url').setDescription('Large embed image URL'))
        .addStringOption((option) => option.setName('thumbnail_url').setDescription('Embed thumbnail URL'))
        .addStringOption((option) => option.setName('footer').setDescription('Footer text'))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('publish').setDescription('Publish or update the button role message')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setmessage')
        .setDescription('Attach button roles to an existing message by ID')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel containing the message').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((option) => option.setName('message_id').setDescription('Message ID to attach buttons to').setRequired(true))
    ),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = getButtonRolesConfig(guildId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Please choose a text channel.', ephemeral: true });
        return;
      }
      config.channelId = channel.id;
      config.messageId = null;
      setButtonRolesConfig(guildId, config);
      await updateButtonRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: `Button role menu channel set to ${channel}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      if (!config.channelId) {
        await interaction.reply({ content: 'Set a channel first with `/buttonroles setchannel`.', ephemeral: true });
        return;
      }
      const role = interaction.options.getRole('role');
      if (!config.roles) config.roles = [];
      if (config.roles.some((item) => item.roleId === role.id)) {
        await interaction.reply({ content: 'That role is already configured.', ephemeral: true });
        return;
      }
      const label = interaction.options.getString('label') || role.name;
      const description = interaction.options.getString('description') || '';
      config.roles.push({ roleId: role.id, roleName: role.name, label, description });
      setButtonRolesConfig(guildId, config);
      await updateButtonRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: `Added button role for ${role.name}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      const index = config.roles?.findIndex((item) => item.roleId === role.id);
      if (index === -1 || index === undefined) {
        await interaction.reply({ content: 'That role is not configured.', ephemeral: true });
        return;
      }
      config.roles.splice(index, 1);
      setButtonRolesConfig(guildId, config);
      await updateButtonRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: `Removed button role for ${role.name}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      if (!config.roles || config.roles.length === 0) {
        await interaction.reply({ content: 'No button roles are configured yet.', ephemeral: true });
        return;
      }
      const lines = config.roles.map((item) => `**${item.label}** — <@&${item.roleId}>${item.description ? ` — ${item.description}` : ''}`);
      await interaction.reply({ content: `Configured button roles:\n${lines.join('\n')}`, ephemeral: true });
      return;
    }

    if (subcommand === 'setembed') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const imageUrl = interaction.options.getString('image_url');
      const thumbnailUrl = interaction.options.getString('thumbnail_url');
      const footer = interaction.options.getString('footer');

      if (title) config.embedTitle = title;
      if (description) config.embedDescription = description;
      if (color) config.embedColor = color;
      if (imageUrl) config.embedImageUrl = imageUrl;
      if (thumbnailUrl) config.embedThumbnailUrl = thumbnailUrl;
      if (footer) config.embedFooter = footer;

      setButtonRolesConfig(guildId, config);
      await updateButtonRoleMessage(interaction.client, interaction.guild);
      await interaction.reply({ content: 'Button role embed settings updated.', ephemeral: true });
      return;
    }

    if (subcommand === 'publish') {
      if (!config.channelId) {
        await interaction.reply({ content: 'Set a channel first with `/buttonroles setchannel`.', ephemeral: true });
        return;
      }
      const message = await updateButtonRoleMessage(interaction.client, interaction.guild);
      if (!message) {
        await interaction.reply({ content: 'Unable to publish the button role message. Check channel permissions.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: 'Button role message published.', ephemeral: true });
      return;
    }

    if (subcommand === 'setmessage') {
      const channel = interaction.options.getChannel('channel');
      const messageId = interaction.options.getString('message_id');

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Please specify a valid text channel.', ephemeral: true });
        return;
      }

      if (!config.roles || config.roles.length === 0) {
        await interaction.reply({ content: 'Add button roles first with `/buttonroles add`.', ephemeral: true });
        return;
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        await interaction.reply({ content: `Could not find message with ID \`${messageId}\` in ${channel}.`, ephemeral: true });
        return;
      }

      // Update config with the message info
      config.channelId = channel.id;
      config.messageId = messageId;
      setButtonRolesConfig(guildId, config);

      // Build buttons and add them to the message
      const { buildButtonRows } = await import('../utils/buttonRoles.js');
      const components = buildButtonRows(config);

      try {
        await message.edit({ components });
        await interaction.reply({ content: `✅ Button roles attached to [that message](${message.url}).`, ephemeral: true, allowedMentions: { parse: [] } });
      } catch (error) {
        console.error('Error attaching buttons:', error);
        await interaction.reply({ content: 'Failed to attach buttons. Make sure I have permission to edit that message.', ephemeral: true });
      }
      return;
    }
  }
};
