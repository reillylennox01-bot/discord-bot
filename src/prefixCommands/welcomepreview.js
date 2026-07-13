import { getGuildConfig } from '../utils/settings.js';
import { buildWelcomeEmbeds } from '../utils/welcomeEmbed.js';

export default {
  name: 'welcomepreview',
  description: 'Preview the current welcome embed settings',
  async execute(message) {
    const config = getGuildConfig(message.guild.id);

    await message.reply({ embeds: buildWelcomeEmbeds(message.guild, message.author, config) });
  }
};
