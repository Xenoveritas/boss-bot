"use strict";

/**
 * Provides the command line interface for the bot.
 */

const defaultOutput = require('./output');
const Commands = require('./commands');
const mock = require('./mock');
const readline = require('readline');

function parseArgs(line) {
  // I'm lazy. In the future this will probably handle things like quotes and
  // whatever, but for now, I don't care.
  return line.split(/\s+/);
}

class CLI {
  constructor(bot, commands, output) {
    this.bot = bot;
    this.output = output || defaultOutput;
    this.channel = new mock.CLIChannel(this.output);
    this.user = new mock.CLIUser();
    commands = commands || Commands.DEFAULT_COMMANDS;
    this._commands = new Map();
    for (let command of commands) {
      this.addCommand(new command());
    }
    // Readline instance
    this._cli = null;
  }
  /**
   * Adds a command to the list of CLI commands. Any command with the given
   * name is replaced.
   */
  addCommand(command) {
    this._commands.set(command.name, command);
    if (Array.isArray(command.aliases)) {
      command.aliases.forEach(alias => { this._commands.set(alias, command); });
    }
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
   * safe to terminate the process if necessary. If a Ctrl-C is received (or
   * more accurately anything that cases a SIGINT to be raised), this will use
   * `process.exit()` to terminate. Likewise, the shutdown command will also use
   * `process.exit()` to terminate if it detects that the shutodwn is
   * taking too long.
   */
  start() {
    if (this._cli !== null)
      return;
    this._cli = readline.createInterface({
      input: process.stdin, output: process.stdout
    });
    this._cli.on('line', (line) => {
      // Parse the command line.
      let args = parseArgs(line);
      // CLI commands override bot commands, so treat this as a CLI command
      // first.
      if (args.length > 0) {
        if (this._commands.has(args[0])) {
          let result = null;
          try {
            result = this._commands.get(args[0]).run(this, args, line);
          } catch (ex) {
            console.error("Error running command:");
            console.error(ex)
          }
          if (result !== null && typeof result === 'object' && typeof result.then === 'function' && typeof result.catch === 'function') {
            // Assume it's a promise (or at least a promise-like object) and
            // "bind" to it.
            this._cli.pause();
            let resume = () => {
              // Note: it's possible CLI is now null if stopCLI got called.
              if (this._cli !== null) {
                this._cli.resume();
                this._cli.prompt();
              }
            };
            result.then(resume, (error) => {
              console.error("Error running command:");
              console.error(error);
              resume();
            });
            // And don't fall through, since the result gets handled in the
            // future.
            return;
          }
        } else {
          // Act as if this were a message received from a user:
          this.bot.handleMessage(new mock.CLIMessage(this.channel, line, this.user));
        }
      }
      this._cli.prompt();
    });
    this._cli.on('SIGINT', () => {
      this._cli.pause();
      // This indicates a desire to quit immediately, so go ahead and do that
      process.exit(1);
    });
    this._cli.on('close', () => {
      if (this._client !== null) {
        this.bot.stop().catch(console.error);
      }
    });
    this._cli.prompt();
    return this;
  }
  stop() {
    if (this._cli !== null) {
      this._cli.close();
      this._cli = null;
    }
  }
  writeLine(message) {
    this.output.writeLine.apply(this.output, arguments);
  }
}

module.exports = CLI;
CLI.CLICommand = Commands.CLICommand;
