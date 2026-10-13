import { getGuildConfig } from '../utils/settings.js';
import { buildWelcomeEmbeds } from '../utils/welcomeEmbed.js';

export default {
  name: 'welcomepreview',
  description: 'Preview the current welcome embed settings',
  async execute(message) {
    const config = getGuildConfig(message.guild.id);
    const embeds = buildWelcomeEmbeds(message.guild, message.author, config);

    await message.reply({
      content: embeds.length > 0 ? undefined : 'The welcome embed is currently cleared.',
      embeds
    });
  }
};
