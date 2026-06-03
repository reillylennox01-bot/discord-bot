import { getButtonRolesConfig, findButtonRole } from '../utils/buttonRoles.js';
import {
  getTicketConfig,
  addOpenTicket,
  removeOpenTicket,
  findTicketOwnerByChannel
} from '../utils/tickets.js';
import { getGuildConfig } from '../utils/settings.js';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  Collection
} from 'discord.js';

function buildTicketChannelName(user) {
  const baseName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'ticket';
  return `ticket-${baseName}-${user.id.slice(-4)}`;
}

async function sendTranscript(channel, transcriptChannel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = sorted.map((message) => {
    const author = `${message.author.tag}`;
    const time = new Date(message.createdTimestamp).toLocaleString();
    let content = message.content || '';
    if (message.attachments.size > 0) {
      const attachments = message.attachments.map((att) => att.url).join(' ');
      content += content ? ` \nAttachments: ${attachments}` : `Attachments: ${attachments}`;
    }
    return `[${time}] ${author}: ${content}`;
  });

  const transcript = lines.join('\n') || 'No messages found.';
  const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: 'ticket-transcript.txt' });
  await transcriptChannel.send({ content: `Transcript for ${channel.name}`, files: [file] }).catch(() => null);
}

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId === 'ticket_open') {
        const guildId = interaction.guild.id;
        const ticketConfig = getTicketConfig(guildId);
        const existingChannelId = ticketConfig.openTickets?.[interaction.user.id];

        if (existingChannelId) {
          const existingChannel = await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
          if (existingChannel) {
            await interaction.reply({ content: `You already have an open ticket: ${existingChannel}`, ephemeral: true });
            return;
          }
          removeOpenTicket(guildId, interaction.user.id);
        }

        const channelName = buildTicketChannelName(interaction.user);
        const permissionOverwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.AddReactions
            ]
          }
        ];

        if (ticketConfig.staffRoleId) {
          permissionOverwrites.push({
            id: ticketConfig.staffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketConfig.categoryId || undefined,
          topic: `Ticket for ${interaction.user.tag} (${interaction.user.id})`,
          permissionOverwrites
        });

        addOpenTicket(guildId, interaction.user.id, ticketChannel.id);

        const closeButton = new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);
        const ticketEmbed = new EmbedBuilder()
          .setTitle(ticketConfig.ticketTitle || 'Ticket Opened')
          .setDescription(
            ticketConfig.ticketDescription ||
              'A staff member will be with you shortly. Press the button below to close this ticket when your issue is resolved.'
          )
          .setColor(ticketConfig.ticketColor ?? 0x00ff00)
          .setFooter({ text: ticketConfig.ticketFooter || 'Thank you for contacting support.' });

        if (ticketConfig.ticketImageUrl) {
          ticketEmbed.setImage(ticketConfig.ticketImageUrl);
        }

        if (ticketConfig.ticketFields?.length) {
          for (const field of ticketConfig.ticketFields) {
            if (!field.name || !field.value) continue;
            ticketEmbed.addFields({ name: field.name, value: field.value, inline: !!field.inline });
          }
        }

        ticketEmbed.addFields(
          { name: 'Requester', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
        )
          .setTimestamp();

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [row] });
        await interaction.reply({ content: `Your ticket has been opened: ${ticketChannel}`, ephemeral: true });
        return;
      }

      if (customId === 'ticket_close') {
        const guildId = interaction.guild.id;
        const ownerId = findTicketOwnerByChannel(guildId, interaction.channel.id);
        if (!ownerId) {
          await interaction.reply({ content: 'This button can only be used inside an active ticket channel.', ephemeral: true });
          return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const ticketConfig = getTicketConfig(guildId);
        const isOwner = interaction.user.id === ownerId;
        const isStaff = ticketConfig.staffRoleId && member?.roles?.cache?.has(ticketConfig.staffRoleId);
        const canManage = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!isOwner && !isStaff && !canManage) {
          await interaction.reply({ content: 'You are not allowed to close this ticket.', ephemeral: true });
          return;
        }

        const transcriptChannelId = ticketConfig.transcriptChannelId;
        if (transcriptChannelId) {
          const transcriptChannel = await interaction.guild.channels.fetch(transcriptChannelId).catch(() => null);
          if (transcriptChannel && transcriptChannel.isTextBased()) {
            await sendTranscript(interaction.channel, transcriptChannel);
          }
        }

        await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
        removeOpenTicket(guildId, ownerId);
        await interaction.channel.delete('Ticket closed');
        return;
      }

      if (!customId.startsWith('buttonrole_toggle:')) return;

      const roleId = customId.split(':')[1];
      const config = getButtonRolesConfig(interaction.guild.id);
      const mapping = findButtonRole(config, roleId);
      if (!mapping) {
        await interaction.reply({ content: 'This role button is no longer configured.', ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: 'Unable to find your member data.', ephemeral: true });
        return;
      }

      const hasRole = member.roles.cache.has(roleId);
      try {
        if (hasRole) {
          await member.roles.remove(roleId);
          await interaction.reply({ content: `Removed role <@&${roleId}> from you.`, ephemeral: true });
        } else {
          await member.roles.add(roleId);
          await interaction.reply({ content: `Added role <@&${roleId}> to you.`, ephemeral: true });
        }
      } catch (error) {
        console.error('Button role assign error:', error);
        await interaction.reply({ content: 'I could not update your role. Check my permissions.', ephemeral: true });
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'command') {
        const restrictedCommands = Array.from(interaction.client.commands.values())
          .filter((command) => command.requiredPermissions && command.data?.name)
          .map((command) => command.data.name)
          .sort();

        const filtered = restrictedCommands
          .filter((name) => name.toLowerCase().includes(focused.value.toLowerCase()))
          .slice(0, 25)
          .map((name) => ({ name, value: name }));

        await interaction.respond(filtered);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const guildConfig = getGuildConfig(interaction.guild.id);
    const allowedMemberCommands = guildConfig.allowedCommands || [];
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    if (command.requiredPermissions) {
      const hasStaffPermissions = interaction.member.permissions.has(command.requiredPermissions);
      const commandName = command.data?.name || interaction.commandName;
      const deniedRoles = guildConfig.commandRoleDeny?.[commandName] || [];
      const hasDeniedRole = interaction.member.roles.cache.some((role) => deniedRoles.includes(role.id));
      if (!hasStaffPermissions && hasDeniedRole) {
        await interaction.reply({
          content: 'Your role is denied from using this restricted command.',
          ephemeral: true
        });
        return;
      }

      const memberAllowed = allowedMemberCommands.includes(commandName);
      if (!hasStaffPermissions && !memberAllowed) {
        await interaction.reply({
          content: 'This command is reserved for staff. Ask a staff member to allow it for members with /commandaccess.',
          ephemeral: true
        });
        return;
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }
};
