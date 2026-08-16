import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import './web.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        client.on(event.default.name, (...args) => event.default.execute(...args, client));
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
