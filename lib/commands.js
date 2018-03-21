/**
 * This describes bot commands. Bot commands are generally triggered by a key
 * word, although in the future more complicated NLP might be used.
 */
 "use strict";

const discord = require('discord.js');

/**
 * Generic command class. At the top level, the commands exist as classes
 * primarily to allow them to generate help about themselves for the built-in
 * help command.
 */
class Command {
  constructor(name, help) {
    this.name = name;
    this.help = help;
  }
  getHelp(locale) {
    return this.help ? this.help : "no help information given";
  }
  /**
   * Run the command.
   * @param {Bot} bot the bot running the command
   * @param {String[]} args arguments given to the command
   * @param {discord.Message} message the original message
   * @param {String} line the line minus any triggering prefix
   * @return {Promise} returns a Promise that will be resolved will the command
   *    finishes, which may be a Promise that resolves when a message was sent
   *    in response to the command. By default nothing will be done when the
   *    Promise resolves successfully, instead this is primarily used to trap
   *    and report errors.
   */
  run(bot, args, message, line) {
    return message.channel.send(`Command ${discord.escapeMarkdown(args[0])} is not implemented. (\`run\` not implemented)`);
  }
}

exports.Command = Command;

/**
 * This is a simple command that uses the getHelp() function of all registered
 * commands to display help.
 */
class HelpCommand extends Command {
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
