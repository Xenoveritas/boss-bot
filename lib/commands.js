/**
 * This describes bot commands. Bot commands are generally triggered by a key
 * word, although in the future more complicated NLP might be used.
 */
 "use strict";

const discord = require('discord.js');

/**
 * The most basic command class. Commands are instances of classes that are
 * used to maintain state within a bot. Generally a command is a singleton,
 * although nothing prevents a command from having multiple instances with
 * different configuration if that makes sense.
 */
class BasicCommand {
  /**
   * Create the command.
   *
   * @param {String} name
   *     the name of the command, which is the default text used to trigger the
   *     command when the user attempts to run it
   * @param {String} [help]
   *     help text for the command
   */
  constructor(name, help) {
    this.name = name;
    this.help = help;
  }

  /**
   * Gets help for the command in the given locale. The default returns the
   * help text set by the constructor and ignores the locale.
   */
  getHelp(locale) {
    return this.help ? this.help : "no help information given";
  }

  /**
   * Run the command.
   *
   * @param {Bot} bot
   *    the bot running the command
   * @param {String[]} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {discord.Message} message
   *    the original message
   * @param {String} line
   *    the line minus any triggering prefix
   * @return {Promise} returns a Promise that will be resolved when the command
   *    finishes, which may be a Promise that resolves when a message was sent
   *    in response to the command. By default nothing will be done when the
   *    Promise resolves successfully, instead this is primarily used to trap
   *    and report errors.
   */
  run(bot, args, message, line) {
    return message.channel.send(`Command ${discord.escapeMarkdown(args[0])} is not implemented. (\`run\` not implemented)`);
  }
}

exports.BasicCommand = BasicCommand;

/**
 * Default cooldown: 3 seconds.
 */
const DEFAULT_COOLDOWN = 3000;
/**
 * Maximum allowed cooldown time: currently a full day.
 */
const MAX_COOLDOWN = 24*60*60*1000;

/**
 * Default amount of time before a "please wait" message is generated.
 */
const DEFAULT_LOADING_DELAY = 250;

/**
 * Default amount of time after a "please wait" message is sent before an
 * attempt will be made to edit it, in case the command completes almost
 * immediately after "loading" was shown. (This is more for Discord flood
 * control than anything else.)
 */
const DEFAULT_POST_LOADING_DELAY = 250;

/**
 * A more complicated Command class, this extends BasicCommand to provide
 * functionality that most commands will likely find useful.
 */
class Command extends BasicCommand {
  /**
   * Create the command.
   *
   * @param {String} name
   *     the name of the command
   * @param {String} help
   *     help text for the command
   * @param {function(bot, String[], discord.Message, String)} callback
   *     if provided, this is installed as the "runCommand" function. This is
   *     intended to be used to create instances of commands without subclassing
   *     Command if desired.
   */
  constructor(name, help, callback) {
    if (arguments.length === 2 && typeof help === 'function') {
      callback = help;
      help = null;
    }
    super(name, help);
    this._cooldowns = new Map();
    this._cooldownTime = DEFAULT_COOLDOWN;
    this._loadingDelay = DEFAULT_LOADING_DELAY;
    this._postLoadingDelay = DEFAULT_POST_LOADING_DELAY;
    if (typeof callback === 'function') {
      this.runCommand = callback;
    }
  }

  get cooldownTime() { return this._cooldownTime; }

  /**
   * Sets the cooldown time for the command. Set to 0 to disable cooldowns
   * entirely. Currently this is limited to the range 0 to one day - attempting
   * to set it outside that range (or with a non-number) sets the cooldown to
   * the default.
   *
   * @param {Number} cooldownTime
   *     the number of milliseconds before a user can re-use <em>this</em>
   *     command
   */
  set cooldownTime(cooldownTime) {
    if (cooldownTime >= 0 && cooldownTime < 24*60*60*1000)
      this._cooldownTime = cooldownTime;
  }

  /**
   * Run the command. This extends the default implementation of BasicCommand
   * in several key ways. First off, it adds a "cooldown" - an optional timeout
   * before this *specific* command may be re-run. Second, it wraps a separate
   * function to allow "delayed" messages - messages that may take a while to
   * run but should return something to the user immediately.
   *
   * The implementation of the command should **not** be in this method, it
   * should be in the {@link #runCommand} method instead.
   */
  run(bot, args, message, line) {
    let result;
    try {
      result = this.runCommand(bot, args, message, line);
    } catch (ex) {
      result = this._handleException(args, ex);
    }
    if (result instanceof Promise) {
      // This creates a new Promise rather than hooking onto the existing one
      // because there may be a delay after the command resolves before the
      // final promise does.
      return new Promise((resolve, reject) => {
        let loadingMessage = null, loadingSentAt = 0, haveFinalResult = false,
          finalResult = null;
        // Handles editing the loading message, specifically dealing with
        // waiting for the post-load message delay.
        let editLoadingMessage = () => {
          // See if this was "too fast"
          let now = new Date().getTime(), wanted = loadingSentAt + this._postLoadingDelay;
          if (now < wanted) {
            // Set a new timeout.
            setTimeout(() => {
              resolve(this._handleResult(finalResult, message.channel, loadingMessage));
            }, wanted - now);
          } else {
            // Resolve immediately.
            resolve(this._handleResult(finalResult, message.channel, loadingMessage));
          }
        };
        let timeout = setTimeout(() => {
          timeout = null;
          loadingSentAt = new Date().getTime();
          // Send a loading message.
          message.channel.send(result.loadingMessage ?
            result.loadingMessage :
            this.getLoadingMessage(bot, args, message, line)).then(message => {
              loadingMessage = message;
              if (haveFinalResult) {
                // Result completed while we were still waiting.
                editLoadingMessage();
              }
            }).catch(ex => {
              // TODO (maybe): still attempt to send the command message?
              reject(ex);
            });
        }, this._loadingDelay);
        result.then(r => {
          if (timeout !== null) {
            // Command completed fast enough: no need to wait on anything.
            clearTimeout(timeout);
            resolve(this._handleResult(r, message.channel));
          } else {
            haveFinalResult = true;
            finalResult = r;
            // See if we actually sent a loading message.
            if (loadingMessage !== null) {
              // Edit it immediately.
              editLoadingMessage();
            }
            // Otherwise, the loading message was attempted but it hasn't
            // resolved yet. Keep the final results and wait for the loading
            // message Promise to resolve, which will then deal with the final
            // message.
          }
        }).catch(ex => {
          reject(ex);
        });
      });
    } else {
      return this._handleResult(result, message.channel);
    }
  }

  /**
   * This is misnamed, it simply translates the exception into a string to be
   * dumped into the output.
   */
  _handleException(args, ex) {
    return `Exception in ${discord.escapeMarkdown(args[0])}: \`${discord.escapeMarkdown(ex.toString())}\``;
  }

  /**
   * Handles the result, implementing the results described by
   * {@link #runCommand}.
   */
  _handleResult(result, channel, loadingMessage) {
    if (!result) {
      // A "falsey" result means "do nothing"
      return Promise.resolve();
    }
    if (typeof result === 'string') {
      if (loadingMessage) {
        return loadingMessage.edit(result);
      } else {
        return channel.send(result);
      }
    } else if (typeof result === 'object') {
      if (loadingMessage) {
        return loadingMessage.edit(result.content, result.embed);
      } else {
        return channel.send(result.content, result.embed);
      }
    }
  }

  /**
   * Run the command. The result can be several things: it can be a string, in
   * which case the string is returned immediately, or it can be an object,
   * in which case the object should have a `content` property which is a string
   * that contains the message contents and an `embed` property which is either
   * `null` or a {@link discord.RichEmbed}.
   *
   * **IMPORTANT**: You **cannot** edit in an attachment after a message was
   * sent. If your command generates an attachment, it **must** send the
   * attachment on its own.
   *
   * @param {Bot} bot
   *    the bot running the command
   * @param {String[]} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {discord.Message} message
   *    the original message
   * @param {String} line
   *    the line minus any triggering prefix
   * @return {String|Object|Promise<String|Object>}
   *    returns either a String containing the message to write (in which case
   *    it is sent as a message to the user immediately) or an Object that
   *    contains a message and either a rich embed or an attachment (which will
   *    also be sent immediately) or a Promise that resolves to either of the
   *    above
   */
  runCommand(bot, args, message, line) {
    return `Command ${discord.escapeMarkdown(args[0])} is not implemented. (\`runCommand\` not implemented)`;
  }

  /**
   * Requests a loading message. It may be easier to set a potential loading
   * message directly on the Promise returned via {@link #runCommand} itself
   * (set a property called `loadingMessage`). If such a property is set, that
   * message will be used and this method will never be invoked.
   *
   * The default simply returns `"Please wait, loading..."`.
   */
  getLoadingMessage(bot, args, message, line) {
    return "Please wait, loading...";
  }

  /**
   * Called when this command was on cooldown for a given user. Note this is
   * only called when the command-specific cooldown was active - the global
   * cooldown ignores this. The default implementation does nothing.
   */
  commandOnCooldown(bot, args, message, line) {
  }
}

exports.Command = Command;

/**
 * This is a simple command that uses the getHelp() function of all registered
 * commands to display help.
 */
class HelpCommand extends BasicCommand {
  constructor(introduction, epilogue) {
    super('help', 'displays available commands');
    this.introduction = introduction;
    this.epilogue = epilogue;
  }
  run(bot, args, message, line) {
    let m = [], locale = bot.getLocale(message.channel);
    if (this.introduction) {
      if (Array.isArray(this.introduction)) {
        Array.prototype.push.apply(m, this.introduction);
      } else {
        m.push(this.introduction);
      }
    } else {
      m.push("**Help for " + discord.escapeMarkdown(bot.name) + "**",
        "Commands can be sent like `" + discord.escapeMarkdown(bot.formatCommand("command")) + "`. Known commands are:");
    }
    // TODO: Hook into commands in a less ... this way
    for (let [command, obj] of bot._commands.entries()) {
      m.push('  \u2022 **' + discord.escapeMarkdown(command) + '** \u2014 ' + obj.getHelp(locale));
    }
    if (this.epilogue) {
      if (Array.isArray(this.epilogue)) {
        Array.prototype.push.apply(m, this.epilogue);
      } else {
        m.push(this.epilogue);
      }
    }
    // TODO: Verify the message we're trying to send fits within message limits
    return message.channel.send(m);
  }
}

exports.HelpCommand = HelpCommand;
