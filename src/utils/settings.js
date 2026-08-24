import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDataDir = path.join(__dirname, '..', '..', 'data');
const legacyDataDir = path.join(__dirname, '..', 'data');
const settingsFile = path.join(rootDataDir, 'guildSettings.json');
const legacySettingsFile = path.join(legacyDataDir, 'guildSettings.json');

function ensureDataFile(filePath) {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
  }
}

function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return source;
  }

  if (target && typeof target === 'object' && !Array.isArray(target) && source && typeof source === 'object' && !Array.isArray(source)) {
    const merged = { ...target };
    for (const [key, value] of Object.entries(source)) {
      merged[key] = key in merged ? deepMerge(merged[key], value) : value;
    }
    return merged;
  }

  return source;
}

function readSettingsFile(filePath) {
  ensureDataFile(filePath);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    console.error(`Failed to load guild settings from ${filePath}:`, error);
    return {};
  }
}

function loadSettings() {
  const legacySettings = readSettingsFile(legacySettingsFile);
  const currentSettings = readSettingsFile(settingsFile);

  return deepMerge(legacySettings, currentSettings);
}

function saveSettings(settings) {
  ensureDataFile(settingsFile);
  ensureDataFile(legacySettingsFile);
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  fs.writeFileSync(legacySettingsFile, JSON.stringify(settings, null, 2));
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
