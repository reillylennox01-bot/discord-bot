import { SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/settings.js';

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return `#${normalized}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('editserverguide')
    .setDescription('Edit the server guide embed settings')
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('The server guide title')
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('The server guide description')
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Embed color hex code, like #00ff00')
    )
    .addStringOption((option) =>
      option
        .setName('footer')
        .setDescription('Footer text for the server guide embed')
    )
    .addStringOption((option) =>
      option
        .setName('field1_name')
        .setDescription('Field 1 title')
    )
    .addStringOption((option) =>
      option
        .setName('field1_value')
        .setDescription('Field 1 text')
    )
    .addStringOption((option) =>
      option
        .setName('field2_name')
        .setDescription('Field 2 title')
    )
    .addStringOption((option) =>
      option
        .setName('field2_value')
        .setDescription('Field 2 text')
    )
    .addStringOption((option) =>
      option
        .setName('field3_name')
        .setDescription('Field 3 title')
    )
    .addStringOption((option) =>
      option
        .setName('field3_value')
        .setDescription('Field 3 text')
    )
    .addStringOption((option) =>
      option
        .setName('field4_name')
        .setDescription('Field 4 title')
    )
    .addStringOption((option) =>
      option
        .setName('field4_value')
        .setDescription('Field 4 text')
    )
    .addStringOption((option) =>
      option
        .setName('field5_name')
        .setDescription('Field 5 title')
    )
    .addStringOption((option) =>
      option
        .setName('field5_value')
        .setDescription('Field 5 text')
    )
    .addStringOption((option) =>
      option
        .setName('field6_name')
        .setDescription('Field 6 title')
    )
    .addStringOption((option) =>
      option
        .setName('field6_value')
        .setDescription('Field 6 text')
    )
    .addStringOption((option) =>
      option
        .setName('field7_name')
        .setDescription('Field 7 title')
    )
    .addStringOption((option) =>
      option
        .setName('field7_value')
        .setDescription('Field 7 text')
    )
    .addStringOption((option) =>
      option
        .setName('field8_name')
        .setDescription('Field 8 title')
    )
    .addStringOption((option) =>
      option
        .setName('field8_value')
        .setDescription('Field 8 text')
    )
    .addStringOption((option) =>
      option
        .setName('field9_name')
        .setDescription('Field 9 title')
    )
    .addStringOption((option) =>
      option
        .setName('field9_value')
        .setDescription('Field 9 text')
    )
    .addStringOption((option) =>
      option
        .setName('field10_name')
        .setDescription('Field 10 title')
    )
    .addStringOption((option) =>
      option
        .setName('field10_value')
        .setDescription('Field 10 text')
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const currentConfig = getGuildConfig(guildId).serverGuide || {};
    const config = { ...currentConfig };

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');

    if (title !== null) config.title = title;
    if (description !== null) config.description = description;
    if (footer !== null) config.footer = footer;
    if (color !== null) {
      const normalized = parseColor(color);
      if (!normalized) {
        await interaction.reply({ content: 'Please provide a valid hex color like #00ff00.', ephemeral: true });
        return;
      }
      config.color = normalized;
    }

    const fields = [];
    for (let i = 1; i <= 10; i += 1) {
      const name = interaction.options.getString(`field${i}_name`);
      const value = interaction.options.getString(`field${i}_value`);
      if (name !== null || value !== null) {
        if (!name || !value) {
          await interaction.reply({ content: `Both field${i}_name and field${i}_value must be provided together.`, ephemeral: true });
          return;
        }
        fields.push({ name, value, inline: false });
      }
    }

    if (fields.length > 0) {
      config.fields = fields;
    }

    if (
      title === null &&
      description === null &&
      color === null &&
      footer === null &&
      fields.length === 0
    ) {
      await interaction.reply({ content: 'No changes provided. Use at least one option to edit the server guide.', ephemeral: true });
      return;
    }

    setGuildConfig(guildId, { serverGuide: config });

    await interaction.reply({ content: 'Server guide updated successfully.', ephemeral: true });
  }
};
