import { SlashCommandBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

function hexToButtonStyle(hex) {
  if (!hex) return ButtonStyle.Primary;
  
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '').toLowerCase();
  
  // Validate hex format
  if (!/^[0-9a-f]{6}$/i.test(cleanHex)) {
    return ButtonStyle.Primary;
  }
  
  // Convert hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Determine dominant color
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  
  // If it's very dark or very light gray, use Secondary
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) {
    return ButtonStyle.Secondary;
  }
  
  // Determine dominant color
  if (r > g && r > b) {
    return ButtonStyle.Danger; // Red
  } else if (g > r && g > b) {
    return ButtonStyle.Success; // Green
  } else if (b > r && b > g) {
    return ButtonStyle.Primary; // Blue
  }
  
  return ButtonStyle.Primary;
}

export default {
  data: new SlashCommandBuilder()
    .setName('addrolebutton')
    .setDescription('Add a role-granting button to a message')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel containing the message')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('message_id').setDescription('Message ID to add button to').setRequired(true)
    )
    .addRoleOption((option) =>
      option.setName('role').setDescription('Role to grant when button is clicked').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('button_label').setDescription('Label for the button (defaults to role name)')
    )
    .addStringOption((option) =>
      option.setName('color').setDescription('Button color as hex (e.g., #FF0000 for red, #00FF00 for green)')
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const messageId = interaction.options.getString('message_id');
    const role = interaction.options.getRole('role');
    const buttonLabel = interaction.options.getString('button_label') || role.name;
    const colorHex = interaction.options.getString('color');

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
      await interaction.reply({ content: 'I can only add buttons to messages I created.', ephemeral: true });
      return;
    }

    // Create or update button row
    const customId = `role_button:${role.id}`;
    const buttonStyle = hexToButtonStyle(colorHex);
    
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(buttonLabel)
      .setStyle(buttonStyle);

    const row = new ActionRowBuilder().addComponents(button);

    // Get existing components and add new button
    let components = message.components || [];
    if (components.length === 0 || components[components.length - 1].components.length >= 5) {
      // Add new row if last row is full or no rows exist
      components.push(row);
    } else {
      // Add to last row if space available
      const lastRow = components[components.length - 1];
      if (lastRow.components.length < 5) {
        lastRow.addComponents(button);
      } else {
        components.push(row);
      }
    }

    try {
      await message.edit({ components });
      await interaction.reply({
        content: `✅ Added button "${buttonLabel}" to [that message](${message.url}). Click the button to toggle the <@&${role.id}> role.`,
        ephemeral: true,
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      console.error('Error adding button:', error);
      await interaction.reply({ content: 'Failed to add button. Make sure I have permission to edit that message.', ephemeral: true });
    }
  }
};
