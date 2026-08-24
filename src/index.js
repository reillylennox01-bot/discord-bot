import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import './web.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lockFilePath = path.join(__dirname, '..', 'data', 'bot.lock');
fs.mkdirSync(path.dirname(lockFilePath), { recursive: true });

let lockHandle;
try {
  lockHandle = fs.openSync(lockFilePath, 'wx');
  fs.writeFileSync(lockHandle, String(process.pid));
  console.log('Bot startup lock acquired.');
} catch (error) {
  if (error && error.code === 'EEXIST') {
    let existingPid;
    try {
      existingPid = Number(fs.readFileSync(lockFilePath, 'utf8').trim());
      if (existingPid) {
        process.kill(existingPid, 0);
      }
    } catch (lockError) {
      if (!existingPid || lockError.code === 'ESRCH' || lockError.code === 'ENOENT') {
        fs.unlinkSync(lockFilePath);
        lockHandle = fs.openSync(lockFilePath, 'wx');
        fs.writeFileSync(lockHandle, String(process.pid));
        console.log('Removed stale bot startup lock and acquired a new one.');
      } else {
        throw lockError;
      }
    }
    if (!lockHandle) {
      console.error('Another bot instance is already running. Shutting down this duplicate runtime.');
      process.exit(1);
    }
  } else {
    throw error;
  }
}

const releaseLock = () => {
  try {
    if (lockHandle) {
      fs.closeSync(lockHandle);
      lockHandle = null;
    }
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  } catch (error) {
    console.warn('Could not release bot startup lock:', error.message);
  }
};

process.on('exit', releaseLock);
process.on('SIGINT', () => {
  releaseLock();
  process.exit(0);
});
process.on('SIGTERM', () => {
  releaseLock();
  process.exit(0);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = await import(pathToFileURL(filePath).href);
    if (command.default && command.default.data && command.default.execute) {
      client.commands.set(command.default.data.name, command.default);
      console.log(`Loaded command handler: ${command.default.data.name}`);
    } else {
      console.warn(`Skipping command file ${file}: missing default export, data, or execute`);
    }
  } catch (error) {
    console.error(`Failed to import command file ${file}:`, error);
  }
}
console.log(`Loaded ${client.commands.size} command handler(s).
`);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  try {
    const event = await import(pathToFileURL(filePath).href);
    if (event.default && event.default.name) {
      if (event.default.once) {
        client.once(event.default.name, (...args) => event.default.execute(...args, client));
      } else {
        client.on(event.default.name, async (...args) => {
          try {
            await event.default.execute(...args, client);
          } catch (error) {
            console.error(`Error in ${event.default.name} event handler:`, error);
            if (event.default.name === 'interactionCreate') {
              const interaction = args[0];
              if (interaction?.isRepliable?.() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                  content: 'Something went wrong while handling that interaction. Please try again.',
                  ephemeral: true
                }).catch(() => null);
              }
            }
          }
        });
      }
      console.log(`Loaded event handler: ${event.default.name}`);
    }
  } catch (error) {
    console.error(`Failed to import event file ${file}:`, error);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

await client.login(process.env.DISCORD_TOKEN);
