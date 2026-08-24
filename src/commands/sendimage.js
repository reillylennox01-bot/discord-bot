import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sendimage')
    .setDescription('Send an image to a channel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send the image to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('The image file to send')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('caption').setDescription('Optional caption for the image')
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const attachment = interaction.options.getAttachment('image');
    const caption = interaction.options.getString('caption');

    // Check if it's a valid image
    if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
      await interaction.reply({
        content: 'Please provide a valid image file (PNG, JPG, GIF, WebP, etc.).',
        ephemeral: true
      });
      return;
    }

    try {
      const attachmentBuilder = new AttachmentBuilder(attachment.url);
      
      await channel.send({
        content: caption || null,
        files: [attachmentBuilder]
      });

      await interaction.reply({
        content: `✅ Image sent to ${channel}${caption ? ` with caption: "${caption}"` : ''}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error sending image:', error);
      await interaction.reply({
        content: 'Failed to send the image. Check my permissions in that channel.',
        ephemeral: true
      });
    }
  }
};
