# Discord Bot Command List

## SLASH COMMANDS

### Administrative Commands

| Command | Description | Who Can Use |
|---------|-------------|------------|
| `/editembed` | Manage embeds with advanced modal-based editing | Administrators only |
| `/editrolebutton` | Edit existing button role options | Administrators only |
| `/sendimage` | Send an image to a channel | Administrators only |

### Guild Management Commands

| Command | Description | Who Can Use | Delegatable |
|---------|-------------|------------|------------|
| `/commandaccess` | Manage which restricted commands members may use | ManageGuild permission required | No |
| `/automod` | Configure automatic moderation filters (enable, disable, addword, removeword, addlink, removelink) | ManageGuild permission (or allowed members) | Yes |

### Moderation Commands

| Command | Description | Who Can Use | Delegatable |
|---------|-------------|------------|------------|
| `/moderation` | Manage guild members (kick, ban, timeout, etc.) | KickMembers, BanMembers, ModerateMembers, or ManageMessages | Yes |
| `/modlog` | View a member's moderation history | KickMembers, BanMembers, ModerateMembers, or ManageMessages | Yes |

### Ticket System

| Command | Description | Who Can Use | Delegatable |
|---------|-------------|------------|------------|
| `/ticket` | Create and manage support tickets | ManageChannels permission (or allowed members) | Yes |

### Role Assignment Commands

| Command | Description | Who Can Use | Delegatable |
|---------|-------------|------------|------------|
| `/buttonroles` | Manage button-based self-assign roles | ManageRoles permission | No |
| `/reactionroles` | Manage the server reaction role menu | ManageRoles permission | No |
| `/addrolebutton` | Create a new button role option with UI builder | ManageRoles permission | No |
| `/twitchsubrole` | Set the Discord role to assign to linked Twitch subscribers | ManageRoles permission (or allowed members) | Yes |

### Welcome Message Commands

| Command | Description | Who Can Use |
|---------|-------------|------------|
| `/setwelcome` | Configure the welcome channel and embed message settings | All members |
| `/setwelcomechannel` | Set the channel where welcome messages are sent | All members |
| `/testwelcome` | Test the welcome message | Raven Guard role members only |
| `/editwelcome` | Edit the welcome message embed settings via UI | All members |

### Server Guide Commands

| Command | Description | Who Can Use |
|---------|-------------|------------|
| `/editserverguide` | Edit the server guide embed settings (title, description, color, fields) | All members |

### Twitch Integration Commands

| Command | Description | Who Can Use |
|---------|-------------|------------|
| `/setstreamer` | Set a Twitch streamer and notification channel for live alerts | All members |
| `/twitchlink` | Manage Twitch account linking for subscriber role assignment | All members |
| `/disabletwitch` | Disable Twitch live notifications for this server | All members |

### Spooky Memes Commands

| Command | Description | Who Can Use |
|---------|-------------|------------|
| `/setspookymemes` | Configure spooky meme delivery at 3AM and enable or disable it | All members |
| `/testspookymeme` | Send the 3AM meme immediately for testing | All members |

---

## PREFIX COMMANDS (Text-based)

| Command | Description | Who Can Use |
|---------|-------------|------------|
| `?ping` | Replies with Pong! | All members |
| `?rolehelp` | Show help for the reaction role system | All members |
| `?serverguide` | Show the server guide embed with tips and rules | All members |
| `?twitchstatus` | Check the status of a Twitch streamer | All members |
| `?welcomepreview` | Preview the current welcome embed settings | All members |

---

## COMMANDS BY WHO CAN USE THEM

### Administrators Only
Members who have **Administrator** permission can use:
- `/editembed` - Manage embeds
- `/editrolebutton` - Edit button roles
- `/sendimage` - Send images

### ManageGuild Permission
Members who can manage guild settings can use:
- `/commandaccess` - Manage command access (not delegatable)
- `/automod` - Configure automod filters (delegatable)

### Moderation Permissions
Members with any of: **KickMembers**, **BanMembers**, **ModerateMembers**, or **ManageMessages** can use:
- `/moderation` - Manage guild members (delegatable)
- `/modlog` - View member moderation history (delegatable)

### ManageChannels Permission
Members who can manage channels can use:
- `/ticket` - Create/manage tickets (delegatable)

### ManageRoles Permission
Members who can manage roles can use:
- `/buttonroles` - Manage button roles
- `/reactionroles` - Manage reaction roles
- `/addrolebutton` - Add button role options
- `/twitchsubrole` - Set Twitch subscriber role (delegatable)

### Raven Guard Role Only
Members with the **Raven Guard** role can use:
- `/testwelcome` - Test welcome message

### All Members (No Restrictions)
Everyone can use:
- `/setwelcome` - Configure welcome messages
- `/setwelcomechannel` - Set welcome channel
- `/editwelcome` - Edit welcome embeds
- `/editserverguide` - Edit server guide
- `/setstreamer` - Set Twitch streamer alerts
- `/twitchlink` - Link Twitch account
- `/disabletwitch` - Disable Twitch notifications
- `/setspookymemes` - Configure spooky memes
- `/testspookymeme` - Test spooky meme
- `?ping` - Ping command
- `?rolehelp` - Role help
- `?serverguide` - Server guide
- `?twitchstatus` - Twitch status
- `?welcomepreview` - Welcome preview

---

## QUICK REFERENCE

### Commands That Can Be Delegated (via `/commandaccess`)
These commands can be allowed/denied for regular members by guild managers:

| Command | Default Permission | Access Management |
|---------|------------------|-------------------|
| automod | ManageGuild | `/commandaccess allow automod` |
| moderation | Moderation permissions | `/commandaccess allow moderation` |
| modlog | Moderation permissions | `/commandaccess allow modlog` |
| ticket | ManageChannels | `/commandaccess allow ticket` |
| twitchsubrole | ManageRoles | `/commandaccess allow twitchsubrole` |

### Permission Levels Explained

| Permission | Applies To | Commands |
|-----------|-----------|----------|
| **Administrator** | Full server control | editembed, editrolebutton, sendimage |
| **ManageGuild** | Guild settings & config | commandaccess, automod |
| **ManageRoles** | Role management | buttonroles, reactionroles, addrolebutton, twitchsubrole |
| **ManageChannels** | Channel management | ticket |
| **Moderation Permissions** | KickMembers, BanMembers, ModerateMembers, ManageMessages | moderation, modlog |
| **All Members** | No restrictions | welcome, server guide, twitch, spooky memes, prefix commands |

### `/commandaccess` Subcommands
Use these to manage command access for your server:

```
/commandaccess list          # See what's currently allowed for members
/commandaccess available     # See what CAN be allowed
/commandaccess allow <cmd>   # Allow members to use a restricted command
/commandaccess revoke <cmd>  # Remove member access for a command
/commandaccess denyrole <cmd> <role>    # Deny a specific role from using a command
/commandaccess allowrole <cmd> <role>   # Re-allow a denied role
/commandaccess rolelist      # See role-based denied commands
```

---

## STATISTICS
- **Total Slash Commands:** 21 (including subcommand groups)
- **Total Prefix Commands:** 5
- **Delegatable Commands:** 5
- **Admin-Only Commands:** 3
- **Unrestricted Commands:** 13
