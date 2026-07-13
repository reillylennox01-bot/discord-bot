import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { getModerationConfig, containsBlockedWord, containsLink, containsBlockedLinkPattern, buildModerationLogEmbed } from '../utils/moderation.js';

// Load prefix (fun) commands from src/prefixCommands
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prefixCommands = new Map();
const prefixDir = path.join(__dirname, '..', 'prefixCommands');
if (fs.existsSync(prefixDir)) {
  const files = fs.readdirSync(prefixDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(path.join(prefixDir, file)).href);
      if (mod.default && mod.default.name && typeof mod.default.execute === 'function') {
        prefixCommands.set(mod.default.name, mod.default);
      }
    } catch (e) {
      console.error('Failed to load prefix command', file, e);
    }
  }
}

export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild || !message.member) return;

    // Handle prefix-based fun commands (start with '?')
    const prefix = '?';
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();
      const cmd = prefixCommands.get(cmdName);
      if (cmd) {
        try {
          await cmd.execute(message, args);
        } catch (err) {
          console.error('Error running prefix command', cmdName, err);
          message.reply('There was an error running that command.');
        }
        return;
      }
    }

    const config = getModerationConfig(message.guild.id);
    if (!config.enabled) return;

    if (message.member.permissions.has('ManageMessages') || message.member.permissions.has('Administrator') || message.member.permissions.has('ManageGuild')) {
      return;
    }

    const content = message.content || '';
    const blockedWord = containsBlockedWord(content, config.blockedWords);
    const hasLink = config.blockLinks ? containsLink(content) : false;
    const blockedLink = containsBlockedLinkPattern(content, config.blockedLinks);

    let reason = null;
    let match = null;
    if (blockedWord) {
      reason = 'blocked word';
      match = blockedWord;
    } else if (hasLink) {
      reason = 'link blocking';
      match = 'Generic blocked link detected';
    } else if (blockedLink) {
      reason = 'blocked link pattern';
      match = blockedLink;
    }

    if (!reason) return;

    await message.delete().catch(() => null);

    try {
      await message.author.send(`Your message in ${message.guild.name} was removed by AutoMod because it contained blocked content (${match}). Please follow the server rules.`);
    } catch {
      // ignore DM failures
    }

    if (config.logChannelId) {
      const logChannel = await message.guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const embed = buildModerationLogEmbed(message, reason, match);
        await logChannel.send({ embeds: [embed] }).catch(() => null);
      }
    }
  }
};
 