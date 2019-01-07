"use strict";

/*
 * This module describes bot commands. Bot commands are generally triggered by a
 * key word, although in the future more complicated NLP might be used.
 */

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
   * @param {!string} name
   *     the name of the command, which is the default text used to trigger the
   *     command when the user attempts to run it - not that there is nothing
   *     that prevents the command being registered under a different name
   * @param {?string} [help]
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
   * @param {!Bot} bot
   *    the bot running the command
   * @param {!Array.<string>} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {!discord.Message} message
   *    the original message
   * @param {!string} line
   *    the line minus any triggering prefix
   * @return {?Promise} returns a Promise that resolves when the command
   *    finishes, which in most cases will be a Promise that resolves when a
   *    message was sent in response to the command. By default nothing will be
   *    done when the Promise resolves successfully, instead this is primarily
   *    used to trap and report errors. `null` (or any falsey value) may be
   *    returned as well, if no asynchronous activity was generated.
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
 * @extends BasicCommand
 */
class Command extends BasicCommand {
  /**
   * Callback for running a command. This is identical to
   * {@link Command#runCommand} but can be set via the constructor as in some
   * cases this makes defining commands easier.
   * @callback Command~runCommand
   * @param {!Bot} bot
   *    the bot running the command
   * @param {!string[]} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {!discord.Message} message
   *    the original message
   * @param {!string} line
   *    the line minus any triggering prefix
   * @return {?(string|object|Promise.<string|object>)}
   *    as described in {@linkcode Command#runCommand}
   */
  /**
   * Create the command.
   *
   * @param {!string} name
   *     the name of the command
   * @param {?string} [help]
   *     help text for the command
   * @param {!Command~runCommand} [callback]
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
   * **NOT IMPLEMENTED YET**
   * Sets the cooldown time for the command. Set to 0 to disable cooldowns
   * entirely. Currently this is limited to the range 0 to one day - attempting
   * to set it outside that range (or with a non-number) sets the cooldown to
   * the default.
   *
   * @param {number} cooldownTime
   *     the number of milliseconds before a user can re-use <em>this</em>
   *     command
   */
  set cooldownTime(cooldownTime) {
    if (cooldownTime >= 0 && cooldownTime < 24*60*60*1000)
      this._cooldownTime = cooldownTime;
  }

  get loadingDelay() { return this._loadingDelay; }

  /**
   * Sets the loading delay. By default, if a Promise is returned from
   * {@linkcode Command#runCommand runCommand()}, a "loading" message will be
   * sent to allow the user to know that the bot did hear their message but a
   * response is still being processed. This sets how long (in milliseconds) it
   * waits for a Promise to resolve before this loading message is sent. The
   * default is 250.
   *
   * Set negative to never send a loading message, no matter the delay.
   *
   * See {@linkcode Command#getLoadingMessage getLoadingMessage()}
   * and {@linkcode Command#runCommand runCommand()} for details on the loading
   * message and when it's sent.
   */
  set loadingDelay(delay) {
    if (typeof delay === 'number')
      this._loadingDelay = delay;
    if (delay === false)
      this._loadingDelay = -1;
  }

  get postLoadingDelay() { return this._postLoadingDelay; }

  /**
   * Sets the post loading delay - this is very similar to
   * {@linkcode Command#loadingDelay loadingDelay}, except for after the
   * loading message has been sent. It specifies the *minimum* amount of time
   * before the loading message will be replaced. Effectively, if a command
   * resolves between the time the loading message was sent and before this
   * time has expired, the loading message will **not** be replaced, instead
   * the delay must elapse before a message is edited. This is intended both to
   * stop a very brief "loading" indicator and also to not spam Discord with
   * edits.
   */
  set postLoadingDelay(delay) {
    if (typeof delay === 'number')
      this._postLoadingDelay = delay;
    if (delay === false)
      this._postLoadingDelay = -1;
  }

  /**
   * Run the command. This extends the default implementation of BasicCommand
   * in several key ways. First off, it adds a "cooldown" - an optional timeout
   * before this *specific* command may be re-run. Second, it wraps a separate
   * function to allow "delayed" messages - messages that may take a while to
   * run but should return something to the user immediately.
   *
   * The implementation of the command should **not** be in this method, it
   * should be in the {@link Command#runCommand runCommand()} method instead.
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
        let timeout = null;
        if (this._loadingDelay >= 0) {
          timeout = setTimeout(() => {
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
        }
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
   * @private
   */
  _handleException(args, ex) {
    return `Exception in ${discord.escapeMarkdown(args[0])}: \`${discord.escapeMarkdown(ex.toString())}\``;
  }

  /**
   * Handles the result, implementing the results described by
   * {@link #runCommand}.
   * @private
   */
  _handleResult(result, channel, loadingMessage) {
    if (!result) {
      // A "falsey" result means "do nothing"
      if (loadingMessage && result !== false) {
        return loadingMessage.delete();
      }
      return Promise.resolve();
    }
    if (typeof result === 'string' || Array.isArray(result)) {
      // Discord.js allows both a string or an array of strings as the content
      // variable, so allow an array.
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
   * Run the command. The parameters are the same as given to
   * {@linkcode Command#run run()}.
   *
   * The result of this method should be one of the following:
   *
   * * `false` - do nothing
   * * `null` or `undefined` - if a loading message was sent, delete it
   * * `string` or `Array.<string>` - a message to send via {@link Discord.TextChannel#send}
   * * `object` with `content` and (optionally) `embed` properties - message
   *    contents to send. Note that you can't attach files through this object -
   *    this is "by design" since attachments can't be edited into existing
   *    messages. `content` may be an array of strings - see the Discord.js
   *    documentation for how that's handled.
   * * `Promise` - a Promise that should resolve to one of the above
   *
   * #### Returning an object
   *
   * Returning an object is the best way to send an embed - the embed will be
   * sent to {@link Discord.TextChannel#send} or edited into the loading message
   * if resolved via a Promise (see below).
   *
   * #### Returning a Promise
   *
   * For any command that requires asynchronous activity, you should return a
   * Promise. This allows `Command` to send a "loading" message to let the user
   * know that a command was received but is still being processed. This loading
   * message is only sent if the command does not resolve after
   * {@linkcode Command#loadingDelay loadingDelay} milliseconds. If it resolves
   * within the timeout, a single message is sent. If a loading message is sent,
   * then the loading message will instead be edited with the contents of the
   * result returned. (If the resolved result is `null` or `undefined`, the
   * loading message will instead be deleted. If the resolved value is `false`
   * then no action will be taken.) There's a second delay period
   * ({@linkcode Command#postLoadingDelay postLoadingDelay}) that must elapse
   * before the loading messaage is edited. This is both to prevent a message
   * from just "flashing" but also to provide a degree of rate limiting.
   *
   * **Important Caveat**
   *
   * Note that Discord does not send notifications for mentions that are edited
   * into a message. If you return a Promise and intend to mention a user in
   * the final response, processing this mention will depend on whether or not
   * the loading message was sent. If you want to mention someone and have a
   * loading message, the mention should be sent in a new message.
   *
   * #### Generating an Attachment
   *
   * Attachments can't be edited into existing messages. Because of this, you
   * can't send an attachment directly. What can be done instead is allowing
   * the default behavior, sending a new message with the attachment, and then
   * either resolving to a replacement message or `null` or `undefined` to
   * delete the loading message or `false` to leave it as-is.
   *
   * @param {!Bot} bot
   *    the bot running the command
   * @param {!string[]} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {!discord.Message} message
   *    the original message
   * @param {!string} line
   *    the line minus any triggering prefix
   * @return {?(string|object|Promise.<string|object>)}
   *    returns as described above
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
   *
   * This is called with the same arguments {@linkcode Command#run run()}
   * received.
   *
   * @param {!Bot} bot
   *    the bot running the command
   * @param {!string[]} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {!discord.Message} message
   *    the original message
   * @param {!string} line
   *    the line minus any triggering prefix
   */
  getLoadingMessage(bot, args, message, line) {
    return "Please wait, loading...";
  }

  /**
   * Called when this command was on cooldown for a given user. Note this is
   * only called when the command-specific cooldown was active - the global
   * cooldown ignores this. The default implementation does nothing. This is
   * called with the same arguments {@linkcode Command#run run()} received.
   *
   * @param {!Bot} bot
   *    the bot running the command
   * @param {!string[]} args
   *    arguments given to the command as parsed by the current bot tokenizer
   * @param {!discord.Message} message
   *    the original message
   * @param {!string} line
   *    the line minus any triggering prefix
   */
  commandOnCooldown(bot, args, message, line) {
  }
}

exports.Command = Command;

/**
 * This is a simple command that uses the getHelp() function of all registered
 * commands to display help.
 * @extends BasicCommand
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
