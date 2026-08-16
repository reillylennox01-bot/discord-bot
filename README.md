# Discord Bot

A starter Discord bot built with `discord.js`.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set your bot token, client ID, guild ID, and Twitch credentials:
   ```bash
   copy .env.example .env
   ```
3. Deploy slash commands to your test guild:
   ```bash
   npm run deploy-commands
   ```
4. Run the bot:
   ```bash
   npm run dev
   ```

## Files

- `src/index.js` - main entrypoint
- `src/events/ready.js` - bot ready event
- `src/events/interactionCreate.js` - slash command handler
- `src/events/guildMemberAdd.js` - welcome message for new server members
- `src/commands/setwelcome.js` - slash command to set the welcome channel and embed content
- `src/commands/reactionroles.js` - manage reaction role menus and self-assign roles
- `src/commands/buttonroles.js` - manage button-based self-assign roles
- `src/commands/automod.js` - configure automatic moderation filters
- `src/commands/rolehelp.js` - show help for the reaction role system
- `src/commands/setstreamer.js` - slash command to set the Twitch streamer and notification channel
- `src/commands/disabletwitch.js` - slash command to disable Twitch live notifications
- `src/commands/twitchstatus.js` - show the configured Twitch live notification status
- `src/commands/welcomepreview.js` - preview the current welcome embed settings
- `src/commands/sendembed.js` - create and send a custom embed to any channel
- `src/commands/ping.js` - sample `/ping` command

## Welcome channel setup

Use `/setwelcome` in Discord to choose which channel receives embed welcome messages.

You can also configure the welcome embed values when running the command:
- `title`
- `description`
- `color` (hex like `#00ff00`)
- `image_url`
- `thumbnail_url`
- `footer`
- `footer_icon_url`
- `author_name`
- `author_icon_url`

Use `/welcomepreview` to see the current welcome embed before new members join.

### Custom embed sender

Use `/sendembed` to build and send a custom embed to any channel. It supports:
- `channel`
- `title`
- `description`
- `color`
- `image_url`
- `thumbnail_url`
- `footer`
- `footer_icon_url`
- `author_name`
- `author_icon_url`
- `field1_name`, `field1_value`, `field1_inline`
- `field2_name`, `field2_value`, `field2_inline`
- `field3_name`, `field3_value`, `field3_inline`

### Reaction role menu

Use `/reactionroles setchannel` to select the channel where the reaction role menu should appear.
Use `/reactionroles add` to add a role option with an emoji, e.g.:
- `/reactionroles add role:@Member emoji:👍 label:Member description:Get access to general chat`

Use `/reactionroles remove` to remove a role option.
Use `/reactionroles list` to view the current reaction roles.

### Button role menu

Use `/buttonroles setchannel` to select the channel where the button role menu should appear.
Use `/buttonroles add` to add a button role option.
Example:
- `/buttonroles add role:@Gamer label:Gamer description:Get access to gaming chat`

Use `/buttonroles remove` to remove a button role option.
Use `/buttonroles list` to view the current button roles.
Use `/buttonroles setembed` to customize the menu embed.
Use `/buttonroles publish` to publish or refresh the button role menu.

### Auto moderation

Use `/automod` to configure automatic message filtering.
Commands include:
- `/automod enable`
- `/automod disable`
- `/automod addword word:badword`
- `/automod removeword word:badword`
- `/automod addlink link:example.com`
- `/automod removelink link:example.com`
- `/automod togglelinks enabled:true`
- `/automod setlogchannel channel:#mod-logs`
- `/automod list`

When enabled, AutoMod deletes blocked content and optionally logs the action to the configured channel.

### Twitch live notifications

Set your Twitch streamer and notification channel using `/setstreamer`.
The bot will check Twitch every 60 seconds and post a live notification when the configured streamer goes live.

## Deploy to Render (Web Service)

1. Create a Render account at https://render.com and connect your GitHub repository.

2. In your repo, `render.yaml` includes a `web` service named `discord-bot` that uses `npm start`.
   - Render will run `npm install` during build and `npm start` to keep the bot alive.
   - The bot exposes a health endpoint at `/` so Render can keep it awake.

3. IMPORTANT: Set environment variables in the Render dashboard for your service.
   - Go to your project → Service → Environment → Add Environment Variable
   - Add `DISCORD_TOKEN` with your bot token (and any other secrets your bot requires).

4. Deploy the service from the Render UI (or push to the branch linked to the service). Check logs for `Logged in as` to confirm startup.

Notes:
- The app listens on the `PORT` environment variable provided by Render.
- Free plans may still sleep after inactivity; use a paid plan for guaranteed 24/7 uptime.

