import {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { setGuildConfig } from '../utils/settings.js';

function buildWelcomeEditorComponents() {
  const firstRowButtons = [];
  for (let index = 1; index <= 5; index += 1) {
    firstRowButtons.push(
      new ButtonBuilder()
        .setCustomId(`editwelcome_slot:${index}`)
        .setLabel(`Slot ${index}`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const secondRowButtons = [];
  for (let index = 6; index <= 10; index += 1) {
    secondRowButtons.push(
      new ButtonBuilder()
        .setCustomId(`editwelcome_slot:${index}`)
        .setLabel(`Slot ${index}`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const firstRow = new ActionRowBuilder().addComponents(...firstRowButtons);
  const secondRow = new ActionRowBuilder().addComponents(...secondRowButtons);

  const thirdRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('editwelcome_preview')
      .setLabel('Preview Embeds')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('editwelcome_send')
      .setLabel('Send All Embeds Now')
      .setStyle(ButtonStyle.Success)
  );

  return [firstRow, secondRow, thirdRow];
}

export default {
  data: new SlashCommandBuilder()
    .setName('editwelcome')
    .setDescription('Open the slot-based welcome embed editor')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The text channel for welcome messages')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption((option) =>
      option
        .setName('send_dm')
        .setDescription('Also send the welcome embed to the member via DM')
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guild.id;
    const updates = {};

    const channel = interaction.options.getChannel('channel');
    if (channel) {
      if (channel.type !== ChannelType.GuildText) {
        await interaction.editReply({ content: 'Please select a text channel for welcome messages.' });
        return;
      }
      updates.welcomeChannelId = channel.id;
    }

    const sendDM = interaction.options.getBoolean('send_dm');
    if (sendDM !== null) {
      updates.sendDM = sendDM;
    }

    if (Object.keys(updates).length > 0) {
      setGuildConfig(guildId, updates);
    }

    await interaction.editReply({
      components: buildWelcomeEditorComponents(),
      content: `Choose a slot to edit welcome embeds.${Object.keys(updates).length > 0 ? '\nBasic welcome settings updated.' : ''}`
    });
  }
};
