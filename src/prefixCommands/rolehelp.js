import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/settings.js';

export default {
  name: 'rolehelp',
  description: 'Show help for the reaction role system',
  async execute(message) {
    const guildId = message.guild.id;
    const embed = new EmbedBuilder()
      .setTitle('Reaction Role Help')
      .setDescription('Use the reaction role commands to configure a self-assign role menu.')
      .addFields(
        { name: '?reactionroles setchannel', value: 'Choose the channel where the reaction role menu will appear.', inline: false },
        { name: '?reactionroles add', value: 'Add a role option with an emoji, label, and optional description.', inline: false },
        { name: '?reactionroles remove', value: 'Remove a role option from the menu.', inline: false },
        { name: '?reactionroles list', value: 'Show the currently configured reaction role options.', inline: false },
        { name: 'Emoji format', value: 'Use a normal emoji like 👍 or a custom emoji like `<:name:id>`.', inline: false },
        { name: 'Notes', value: 'When users react to the menu message, they will receive the configured role. Removing the reaction removes the role.', inline: false }
      )
      .setColor(0x5865f2)
      .setFooter({ text: 'Reaction role command help' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
