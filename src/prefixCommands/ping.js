export default {
  name: 'ping',
  description: 'Replies with Pong! (prefix command)',
  async execute(message/*, args */) {
    await message.reply('Pong!');
  }
};
