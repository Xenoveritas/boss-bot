/**
 * Module for implementing the basic bot.
 */

"use strict";

const Discord = require('discord.js'),
  fs = require('fs'),
  path = require('path'),
  CLI = require('./cli/cli'),
  commands = require ('./commands'),
  Configuration = require('./configuration');

/**
 * Utility class for parsing a Discord permission. Expects a string.
 */
function parsePermission(permission) {
  if (permission in Discord.Permissions.FLAGS) {
    return Discord.Permission.FLAGS[permission];
  } else {
    throw new Error("Unknown Discord permission \"" + permission + "\"");
  }
}

const MAX_GLOBAL_COOLDOWN = 30*60*1000;

/**
 * Basic bot class. This provides the basic support for recognizing commands
 * and executing them. The constructor takes a set of default configuration
 * values that can be overridden with user-supplied configuration.
 */
class Bot {
  constructor(configuration) {
    this._client = null;
    // Make sure this is a "real" configuration file: that it has a getConfig
    // function.
    if (configuration !== null && typeof configuration === 'object') {
      if (typeof configuration.getConfig !== 'function') {
        configuration = new Configuration(configuration);
      }
    } else if (configuration !== undefined) {
      throw new Error("Invalid configuration " + Object.prototype.toString.apply(configuration));
    } else {
      configuration = new Configuration();
    }
    this._config = configuration;
    this._cli = new CLI(this);
    this._commands = new Map();
    this._prefix = this.getConfig("prefix", "bot");
    this._cooldowns = new Map();
    // Set the "true default" because the setter just ignores invalid values
    this._cooldown = 2000;
    this._channelCooldown = 125;
    // Then invoke the setter with the configured value.
    this.globalCooldown = this.getConfig("globalCooldown");
    this.globalChannelCooldown = this.getConfig("globalChannelCooldown");
    this.prefixMatcher = Bot.PREFIX_WHOLE_WORD;
  }

  get loggedIn() { return this._client !== null; }

  /**
   * The status as a string. The strings are the Discord.Status values in
   * lower case, or "logged out" if start() has not been called (or stop() has
   * been called).
   */
  get status() {
    if (this._client === null)
      return "logged out";
    let status = this._client.status;
    for (let name in Discord.Constants.Status) {
      if (Discord.Constants.Status[name] === status)
        return name.toLowerCase();
    }
    return "unknown status " + status;
  }

  /**
   * Gets the Discord client object, if there is one. When logged out, this is
   * null.
   */
  get client() {
    return this._client;
  }

  /**
   * Gets the generic prefix.
   */
  get prefix() {
    return this._prefix;
  }

  /**
   * Sets the prefix used to trigger the bot to respond outside of DMing the bot
   * directly. The prefix is currently a simple string. The prefix will be
   * compared case-insensitively based on the locale of the channel.
   *
   * (At some point additional channel-specific configuration might be made
   * possible but at present it isn't.)
   */
  set prefix(prefix) {
    this._prefix = prefix;
  }

  /**
   * Allows a prefix matcher to be set as a property. This is the same as the
   * single argument form of {@link #setPrefixMatcher}.
   */
  set prefixMatcher(matcher) {
    this.setPrefixMatcher(matcher);
  }

  get globalCooldown() {
    return this._cooldown;
  }

  /**
   * The global cooldown. Setting it is "retroactive": the last time a user
   * executed a command is remembered and then compared against the global
   * cooldown value, so changing this value applies "immediately." The global
   * cooldown is truly global: it is applied in {@link #handleMessage} to any
   * message sent. No warning message is generated if a user attempts to use
   * commands "too fast" within the global cooldown: all messages are silently
   * ignored.
   *
   * Currently the global cooldown is limited to being within 0ms to 30 minutes.
   */
  set globalCooldown(cooldown) {
    if (cooldown >= 0 && cooldown <= MAX_GLOBAL_COOLDOWN) {
      this._cooldown = cooldown;
    }
  }

  get globalChannelCooldown() { return this._channelCooldown; }

  /**
   * Sets the global channel cooldown. The global channel cooldown is much like
   * the global cooldown except it applies to channels, not users, and the
   * default is much shorter (a mere 125ms). It's used to prevent the bot from
   * flooding a channel should multiple users attempt to send commands at the
   * same time.
   *
   * At some point this may be changed to queueing up commands so that they'll
   * still resolve, just never any faster than the global channel cooldown.
   *
   * Currently the global channel cooldown is limited to being within 0ms to 30
   * minutes.
   */
  set globalChannelCooldown(cooldown) {
    if (cooldown >= 0 && cooldown <= MAX_GLOBAL_COOLDOWN) {
      this._channelCooldown = cooldown;
    }
  }

  /**
   * Sets a prefix matcher. The matcher is an object with two functions:
   * `match` is a function with the singature
   * `function(prefix, message, locale)` that handles matching a prefix, and
   * `format` is a function with the signature
   * `function(prefix, command, locale)` that's used to display a command with
   * the given prefix. In both, `prefix` is the prefix for this
   * bot and `locale` is the current locale, which is in [a form accepted by the
   * JavaScript I18N APIs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).
   * `message` is the message string as sent by the user (including any
   * Markdown) and `command` is a command string.
   *
   * `match` should return the message with the prefix stripped or `null`
   * (or `false`) if the prefix wasn't found. `format` returns the formatted
   * string.
   */
  setPrefixMatcher(matcher, formatter) {
    // Yay JS overloading.
    if (arguments.length === 0) {
      throw new Error("No prefix matcher given");
    } else if (arguments.length === 1) {
      if (typeof matcher === 'object') {
        formatter = matcher.format;
        matcher = matcher.match;
      } else {
        throw new Error("Invalid argument " + matcher);
      }
    }
    if (typeof matcher !== 'function') {
      throw new Error("Matcher must be a function, got " + matcher);
    }
    if (typeof formatter !== 'function') {
      throw new Error("Formatter must be a function, got " + formatter);
    }
    this._prefixMatcher = matcher;
    this._prefixFormatter = formatter;
  }

  /**
   * Format a given command to show how to invoke it. An optional channel may
   * be given to format the command for that specific channel, otherwise the
   * "generic" information is returned.
   */
  formatCommand(command, channel) {
    // Since there is currently no channel-specific configuration, channel is
    // basically useless, but:
    return this._prefixFormatter(this._prefix, command, this.getLocale(channel));
  }

  /**
   * Gets a configuration option for the given key.
   *
   * @param {Discord.Message|Discord.Channel|Discord.Guild|Discord.User} context
   *    the context within which the configuration value is being requested.
   *    If null (or not specified), defaults to the global context.
   * @param {String} key
   *    the configuration key
   * @param defaultValue
   *    the default value if no configuration value is given, defaults to
   *    undefined
   */
  getConfig(context, key, defaultValue) {
    if (arguments.length < 1)
      throw new Error("Need a key");
    if (arguments.length === 1) {
      return this._config.get(context);
    } else if (arguments.length === 2) {
      // If the context is a string, then this is a key, defaultValue pair.
      // Otherwise, it's a context/key pair.
      if (typeof context === 'string') {
        return this._config.get(context, key);
      } else {
        return this._config.getConfig(context, key);
      }
    } else {
      return this._config.getConfig(context, key, defaultValue);
    }
  }

  /**
   * Gets the configured required permissions. This works by pulling the
   * "user.permissions" config value and parsing it based on
   * Discord.Permissions.FLAGS and ORing each permission together. If there are
   * no permissions set, this defaults to [ "ADD_REACTIONS", "READ_MESSAGES",
   * "SEND_MESSAGES" ].
   */
  getConfiguredPermissions() {
    let permissions = this.getConfig("user.permissions",
      Discord.Permissions.FLAGS.ADD_REACTIONS |
      Discord.Permissions.FLAGS.READ_MESSAGES |
      Discord.Permissions.FLAGS.SEND_MESSAGES
    );
    if (typeof permissions === 'number') {
      // Use it directly
      return permissions;
    } else if (typeof permissions === 'string') {
      return parsePermission(permissions);
    } else {
      return permissions.reduce((result, permission) => {
        return result | parsePermission(permission);
      }, 0);
    }
  }

  /**
   * Gets the locale to be used in a given channel. The current default
   * implementation simply returns the "locale" configuration value. If there
   * is no locale configuration, this returns "en". This is used to determine
   * how to parse a message coming in on a given channel.
   */
  getLocale(channel) {
    return this.getConfig("locale", "en");
  }

  /**
   * Generates a URL that can be used to add the bot to a server the user
   * controls.
   */
  getBotJoinURL() {
    let clientId = this.getConfig("client.id", "<client ID>");
    return 'https://discordapp.com/api/oauth2/authorize?client_id=' +
      clientId + '&scope=bot&permissions=' +
      this.getConfiguredPermissions();
  }

  /**
   * Gets the bot's name. This is used in various places to display messages to
   * the user.
   */
  get name() {
    return "Bot";
  }

  /**
   * Loads configuration from a file. Returns a Promise that resolves to this
   * Bot when the configuration is loaded. This adds all configuration values
   * from the given file into the current configuration, overriding any existing
   * values and adding new ones.
   *
   * @param {String} filename
   *    the file to add
   */
  loadConfig(filename) {
    return new Promise((resolve, reject) => {
      fs.readFile(filename, 'utf8', (error, data) => {
        if (error) {
          reject(error);
        } else {
          try {
            this._config.merge(JSON.parse(data));
            resolve(this);
          } catch (ex) {
            reject(ex);
          }
        }
      });
    });
  }

  /**
   * Adds a command to the list of CLI commands. Any command with the given
   * name is replaced.
   */
  addCLICommand(command) {
    this._cli.addCommand(command);
  }
  /**
   * Uses the readline library to start a command line interface. The
   * interface can be used to interact with the bot directly. This returns
   * immediately, as the interface is event-driven.
   *
   * Note that if you implement this, all registered commands must be ready to
   * receive messages from the command line. CLI messages do not implement the
   * entire Discord API.
   *
   * Returns the Bot itself for method chaining.
   *
   * This can be used prior to the bot being logged in if wanted, enabling a
   * basic "offline" mode.
   *
   * Important: the CLI assumes that it's the only thing running, and that it's
   * safe to terminate the process if necessary. If a Ctrl-C is received, this
   * will use process.exit() to terminate. Likewise, the shutdown command will
   * also use process.exit() to terminate if it detects that the shutodwn is
   * taking too long.
   */
  startCLI() {
    return this._cli.start();
  }
  stopCLI() {
    return this._cli.stop();
  }
  /**
   * Creates the Discord client and starts the bot actually running. Returns a
   * Promise that resolves when the bot is ready.
   */
  start() {
    if (this._client !== null) {
      throw new Error("Client already started");
    }
    // Make sure we have our token. Client ID is only required to generate a
    // join URL.
    let token = this.getConfig('user.token');
    // Make sure the configured permissions are sane. (This is for "fail fast"
    // reasons, otherwise this won't fail until the bot is started.)
    this.getConfiguredPermissions();
    this._client = new Discord.Client();

    this._client.on('message', message => {
      this.handleMessage(message);
    });

    this._client.once('ready', () => { this.ready(); });

    return this._client.login(token).then(() => { return this; });
  }
  /**
   * Stops the bot from running, logging out of Discord and then destroying the
   * client.
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (this._client === null) {
        resolve(this);
      } else {
        this._client.destroy().then(() => {
          this._client = null;
          resolve(this);
        }, reject);
      }
    });
  }
  /**
   * Intended to be used by subclasses, this is called when the client is ready
   * following start() being called. The default implementation does nothing.
   */
  ready() { }
  addCommand(command, ...aliases) {
    // If the command is a function, assume it's a constructor.
    if (typeof command === 'function') {
      // Instantiate the command
      command = new command();
    }
    if (arguments.length === 1) {
      aliases = [ command.name ];
    }
    for (let alias of aliases) {
      this._commands.set(alias.toLocaleLowerCase(this.getLocale()), command);
    }
  }
  /**
   * Adds commands that are either an object where the keys are the command
   * names, or an array of command objects.
   */
  addCommands(commands) {
    if (Array.isArray(commands)) {
      // Treat it like an array.
      commands.forEach(command => {
        this.addCommand(command);
      });
    } else {
      for (let name in commands) {
        this.addCommand(commands[name], name);
      }
    }
  }
  /**
   * Looks up a command. Currently commands are matched by looking them up
   * based on their lowercase versions in the command map.
   */
  findCommand(command) {
    return this._commands.get(command.toLocaleLowerCase(this.getLocale()));
  }

  /**
   * Handle receiving a message. This is bound to the Discord.js
   * "message" event, and exposed as an instance method to allow it to be
   * overridden as necessary. It deals with checking if a message should be
   * handled by the bot, and then parsing it into a command if it should.
   *
   * Messages that are DMed straight to the bot (or are mocked via the CLI) do
   * not require the prefix, while those sent in any other channels do.
   */
  handleMessage(message) {
    if (message.author.bot) {
      // Always ignore messages from bots. This also prevents us from
      // potentially trying to talk to ourself.
      return;
    }
    // See if we're under cooldown.
    // Cooldowns are based on a user's snowflake.
    let lastMessage = this._cooldowns.get(message.author.id),
      now = new Date().getTime();
    if (typeof lastMessage === 'number' && lastMessage + this._cooldown > now) {
      // Under cooldown - ignore message.
      this.messageOnGlobalCooldown(message, lastMessage + this._cooldown);
      return;
    }
    // Channels also have a cooldown time. As IDs are all snowflakes, IDs cannot
    // be the same even across object types.
    lastMessage = this._cooldowns.get(message.channel.id);
    if (typeof lastMessage === 'number' && lastMessage + this._channelCooldown > now) {
      this.messageOnGlobalChannelCooldown(message, lastMessage + this._channelCooldown);
      return;
    }
    // In any case, throw the user and channel into the global cooldown.
    this._cooldowns.set(message.author.id, now);
    this._cooldowns.set(message.channel.id, now);
    // See if we care about this message.
    if (message.channel.type === 'dm' || message.channel.type === 'cli') {
      // This is a DM straight to the bot. If there is a prefix, strip it,
      // otherwise behave like normal.
      let content = this._prefixMatcher(this._prefix, message.content, this.getLocale(message.channel));
      this.handleCommand(typeof content === 'string' ? content : message.content, message);
    } else if (message.channel.type === 'text') {
      let command = this._prefixMatcher(this._prefix, message.content, this.getLocale(message.channel));
      if (typeof command === 'string') {
        this.handleCommand(command, message);
      }
    }
  }
  /**
   * Handle a command. This receives a message and then dispatches it to the
   * appropriate command handler.
   *
   * @param {String} command the command string extracted out of the message
   * @param {Discord.Message} message the original message
   */
  handleCommand(command, message) {
    if (/^\s*$/.test(command)) {
      // If the command is entirely whitespace, drop down to the default handler.
      return this._catch(this.blankCommand(command, message));
    }
    // Command should be whatever the next set of things are.
    let args = command.trim().split(/\s+/);
    // See if we know what this command is.
    let commandObj = this.findCommand(args[0]);
    if (typeof commandObj === 'object') {
      let result = commandObj.run(this, args, message);
      if (typeof result === 'object' && result != null && typeof result.catch === 'function') {
        this._catch(result, `Error running ${command}:`);
      }
    } else {
      this._catch(this.unknownCommand(command, args, message), `Error handling unknown command ${command}:`);
    }
  }
  /**
   * Deal with an unknown command. The default simply sends "Unknown command"
   * followed by the parsed command name.
   *
   * @param {String} command
   *    the unprefixed command (as determined by the formatter)
   * @param {String[]} args
   *    the parsed arguments for the command
   * @param {discord.Message} message
   *    the original message containing the command
   * @return {Promise}
   *    either a promise that resolves when the unknown command is processed
   *    (generally this is for error handling) or a falsey value to ignore
   */
  unknownCommand(command, args, message) {
    return message.channel.send(`Unknown command "${Discord.escapeMarkdown(command)}".`).catch(error => {
      this.handleError(error, "Unable to send message:");
    });
  }
  /**
   * Handle a blank command. The default implementation does nothing. (A blank
   * command happens when the prefix is sent with only whitespace after it.)
   */
  blankCommand(command, message) {
  }

  /**
   * Internal method to hook an error handler onto a Promise. Promise may be
   * falsey to ignore. Always forwards errors to {@link #handleError}.
   * @private
   */
  _catch(promise, where) {
    if (promise) {
      promise.catch(error => {
        this.handleError(error, where);
      });
    }
  }

  /**
   * Generic error handler. Used for rejected promises. Generally just outputs
   * the error to the console.
   * @param {object} error the object given to the rejected promise
   * @param {String} [where] an optional string describing what failed.
   */
  handleError(error, where) {
    if (where)
      console.error(where);
    console.error(error);
  }

  /**
   * Called when a message is ignored because it happened within a user's global
   * cooldown. The default implementation does nothing.
   *
   * @param {discord.Message} message
   *     the message that was ignored
   * @param {Number} cooldownExpires
   *     the UNIX timestamp when the cooldown expires (note that changing the
   *     global cooldown value will effectively change this as well)
   */
  messageOnGlobalCooldown(message, cooldownExpires) {
  }

  /**
   * Called when a message is ignored because it happened within a channel's
   * global cooldown. The default implementation does nothing, although in the
   * future, it might set a timeout that will retrigger {@link Bot#handleMessage}
   * with the message once the cooldown expires, effectively queuing up
   * messages if a channel is flooding the bot.
   *
   * @param {discord.Message} message
   *     the message that was ignored
   * @param {Number} cooldownExpires
   *     the UNIX timestamp when the cooldown expires (note that changing the
   *     global cooldown value will effectively change this as well)
   */
  messageOnGlobalChannelCooldown(message, cooldownExpires) {
  }
  /**
   * Runs "garbage collection" on the bot and all commands. Various information
   * is cached that may no longer be necessary, and this causes the bot to go
   * through all its information and delete references that may no longer be
   * necessary but also can't be held by weak references. (Specifically, this
   * culls unnecessary global cooldown entries.)
   */
  garbageCollect() {
    // Q: Can we delete keys from the map while iterating over it?
    // A: The ECMA spec states that yes, keys may be deleted during forEach.
    // It is less clear for iterators.
    let deleteBefore = new Date().getTime() - MAX_GLOBAL_COOLDOWN;
    this._cooldowns.forEach((value, key) => {
      if (value < deleteBefore) {
        this._cooldowns.delete(key);
      }
    });
  }
}

// Prefix modes

/**
 * Prefix is a separate word, so if the prefix is `"bot"`, then the strings
 * `"bot hello"` and `"  bot   hello"` would trigger the bot but `"bothello"`
 * would not.
 */
Bot.PREFIX_WHOLE_WORD = {
  match: function(prefix, message, locale) {
    let m = /^\s*(\S+)/.exec(message);
    if (m && m[1].localeCompare(prefix, locale, { usage: "search" }) === 0) {
      return message.substring(m[0].length);
    } else {
      return null;
    }
  },
  format: function(prefix, command, locale) {
    return prefix + " " + command;
  }
};

/**
 * Prefix is before the command, so if the prefix is "!", then "!hello" would
 * trigger the command "hello" while just "hello" would be ignored.
 */
Bot.PREFIX_WITH_COMMAND = {
  match: function(prefix, message, locale) {
    let m = /^\s*(\S+)/.exec(message);
    if (m && m[1].length >= prefix.length &&
        m[1].substring(0, prefix.length).localeCompare(prefix, locale, { usage: "search" }) === 0) {
      return message.substring(m[0].length - m[1].length + prefix.length);
    } else {
      return null;
    }
  },
  format: function(prefix, command, locale) {
    return prefix + command;
  }
};

// Exports:
module.exports = Bot;
// This bit of weirdness is to allow
// const { Bot, Command } = require('boss-bot')
// if someone wants to do that for any reason.
Bot.Bot = Bot;
Bot.Configuration = Configuration;
Bot.CLICommand = CLI.CLICommand;
Bot.Command = commands.Command;
Bot.BasicCommand = commands.BasicCommand;
Bot.HelpCommand = commands.HelpCommand;
