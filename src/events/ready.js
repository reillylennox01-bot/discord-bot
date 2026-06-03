import { startTwitchLiveChecker } from '../twitchLive.js';
import { startSpookyMemeScheduler } from '../spookyMemeScheduler.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    await startTwitchLiveChecker(client);
    startSpookyMemeScheduler(client);
  }
};
