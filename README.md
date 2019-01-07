# Boss Bot

A library for writing Discord bots using Node.js. This provides a whole bunch of "glue code" for dealing with reading messages and implementing "commands" that the bot will respond to for those messages. It also provides basic support for reading configuration and a simple CLI that can be used to monitor the bot on the server it runs on.

## Basic Example

You can get a very basic bot simply by doing the following:

```javascript
const Bot = require('boss-bot');

let bot = new Bot({
  prefix: "bot"
});

bot.startCLI();
```

Note that the bot will not be logged into Discord - and as it was given no API key in its configuration, it cannot be logged into Discord in any case.

## Logging Into Discord

Before the bot can connect to Discord, it requires a token. The token is a unique, **secret** value that is associated with each bot user. It uniquely identifies the bot and proves to Discord that the bot is authorized to act under that bot user.

To create a bot token, you'll need to log into Discord and go to the [Discord Developer Portal](https://discordapp.com/developers/applications/). This allows you to create a new application and then a new bot user. This bot user will have the token you need.

**DO NOT CHECK IN YOUR TOKEN**

The token is a secret, so please remember you should **not** check it into any `git` repositories.

The token is provided to the Bot class using the `user.token` configuration parameter, which can be set either like:

```json
{ "user": { "token": "Your Secret Token" } }
```

Or just as a single key:

```json
{ "user.token": "Your Secret Token" }
```

There are a couple of other things you can also specify under the `user` configuration key other than the token, but the token is the only absolutely required bit of information before the bot can log into Discord.

The most likely other thing you might want to set are the bot permissions. These **do not** get provided automatically, they're simply used when generating the join URL via `Bot.getBotJoinURL()`.

There are two ways to specify these, either as an array of keys as specified in [Discord.js's `Discord.Permission.FLAGS` field](https://discord.js.org/#/docs/main/stable/class/Permissions?scrollTo=s-FLAGS) or as the single number that the "permission generator" in the bot configuration page provides. (The array of permission flags is probably easier to read.)

These permissions are simply given to Discord so that the user is prompted to provide them when they invite the bot to their server. However that is the **only** place they are used: once the bot has been invited, these do nothing. Only the server administrator can set permissions for the bot.