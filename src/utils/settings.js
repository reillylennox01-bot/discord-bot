import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const settingsFile = path.join(dataDir, 'guildSettings.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({}, null, 2));
  }
}

function loadSettings() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    console.error('Failed to load guild settings:', error);
    return {};
  }
}

function saveSettings(settings) {
  ensureDataFile();
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

export function getGuildConfig(guildId) {
  const settings = loadSettings();
  return settings[guildId] || {};
}

export function setGuildConfig(guildId, config) {
  const settings = loadSettings();
  settings[guildId] = {
    ...settings[guildId],
    ...config
  };
  saveSettings(settings);
  return settings[guildId];
}
