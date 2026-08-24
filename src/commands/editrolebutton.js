import {
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

function hexToButtonStyle(hex) {
  if (!hex) return ButtonStyle.Primary;
  
  const cleanHex = hex.replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]{6}$/i.test(cleanHex)) {
    return ButtonStyle.Primary;
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) {
    return ButtonStyle.Secondary;
  }
  
  if (r > g && r > b) {
    return ButtonStyle.Danger;
  } else if (g > r && g > b) {
    return ButtonStyle.Success;
  } else if (b > r && b > g) {
    return ButtonStyle.Primary;
  }
  
  return ButtonStyle.Primary;
}

export default {
  data: new SlashCommandBuilder()
    .setName('editrolebutton')
    .setDescription('Edit role-granting buttons on a message (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel containing the message')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('message_id').setDescription('Message ID with role buttons').setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const messageId = interaction.options.getString('message_id');

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'Please specify a valid text channel.', ephemeral: true });
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.reply({ content: `Could not find message with ID \`${messageId}\` in ${channel}.`, ephemeral: true });
      return;
    }

    if (!message.author || message.author.id !== interaction.client.user.id) {
      await interaction.reply({ content: 'I can only edit buttons on messages I created.', ephemeral: true });
      return;
    }

    if (!message.components || message.components.length === 0) {
      await interaction.reply({ content: 'That message does not contain any buttons to edit.', ephemeral: true });
      return;
    }

    // Extract all role buttons and their positions
    const roleButtons = [];
    message.components.forEach((row, rowIndex) => {
      row.components.forEach((button, buttonIndex) => {
        if (button.data.custom_id?.startsWith('role_button:')) {
          const roleId = button.data.custom_id.replace('role_button:', '');
          roleButtons.push({
            rowIndex,
            buttonIndex,
            customId: button.data.custom_id,
            label: button.data.label || 'Unknown',
            roleId,
            style: button.data.style
          });
        }
      });
    });

    if (roleButtons.length === 0) {
      await interaction.reply({ content: 'No role buttons found on that message.', ephemeral: true });
      return;
    }

    // Create buttons for each role button
    const editRows = [];
    let currentRow = [];

    if (!channel.id) {
      await interaction.reply({ content: 'Error: Channel ID is invalid. Please try again.', ephemeral: true });
      return;
    }

    console.log(`[editrolebutton] Creating buttons with channel.id: ${channel.id}, messageId: ${messageId}`);

    roleButtons.forEach((btn, index) => {
      const customId = `editrolebutton_edit:${channel.id}:${messageId}:${index}`;
      console.log(`[editrolebutton] Button ${index} custom ID: ${customId} (length: ${customId.length})`);
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(`Edit: ${btn.label}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`editrolebutton_remove:${channel.id}:${messageId}:${index}`)
          .setLabel('Remove')
          .setStyle(ButtonStyle.Danger)
      );
      editRows.push(row);
    });

    await interaction.reply({
      content: `Found **${roleButtons.length}** role button${roleButtons.length === 1 ? '' : 's'} on that message. Choose which button to edit:`,
      components: editRows,
      ephemeral: true
    });
  }
};
