/**
 * This module contains CLI-specific commands.
 */

"use strict";

const fs = require('fs');
const mock = require('./mock');
const defaultOutput = require('./output');
const heapdump = (function() {
  try {
    return require('heapdump');
  } catch(ex) {
    return null;
  }
})();

/**
 * Base class for CLI commands.
 *
 * @param {String} [name] the command name
 * @param {String} [help] help text
 */
class CLICommand {
  constructor(name, help) {
    this.name = name;
    this.help = help;
  }
  /**
   * Run the command. Note that unlike bot commands, this is given a set of
   * string arguments.
   *
   * CLI commands may return a Promise, which will prevent the prompt from
   * being displayed until the promise resolves.
   *
   * @param {CLI} cli the command line interface running the command
   * @param {Array<String>} args the arguments as supplied by the user
   * @param {String} rawArgs the raw command line string before any parsing
   */
  run(cli, args, rawArgs) {
    throw new Error("Not implemented.");
  }
  /**
   * Display additional help to the console. Default simply repeats the help
   * text given to the constructor, but other commands can generate more
   * detailed information.
   *
   * @param {CLI} cli the command line interface running the command
   * @param {Array<String>} args any arguments past "help command" given to the
   *   help command
   */
  detailedHelp(cli, args) {
    cli.writeLine(this.help);
  }
}

class LogoutCommand extends CLICommand {
  constructor() {
    super("logout", "logs out of Discord");
  }
  run(cli, args) {
    if (cli.bot.loggedIn) {
      cli.writeLine("Logging out...");
      return cli.bot.stop();
    }
    return null;
  }
}

class ShutdownCommand extends CLICommand {
  constructor() {
    super("shutdown", "log out of Discord if logged in, and then close");
    this.aliases = [ "exit", "quit" ];
  }
  run(cli, args) {
    cli.writeLine("Shutting down " + cli.bot.name + "...");
    setTimeout(() => {
      cli.writeLine(cli.bot.name + " not shutdown after 30 seconds, killing it.");
      cli.writeLine("Active handles:");
      for (let handle of process._getActiveHandles()) {
        cli.writeLine(handle);
      }
      cli.writeLine("Active requests:");
      for (let request of process._getActiveRequests()) {
        cli.writeLine(request);
      }
      process.exit(1);
    }, 30000).unref();
    return cli.bot.stop().then(() => {
      cli.writeLine(cli.bot.name + " shut down.");
      cli.stop();
      // It's unclear what remains open after Discord has been activated, but
      // something lingers, so:
      setImmediate(() => { process.exit(0); });
    });
  }
}

class LoginCommand extends CLICommand {
  constructor() {
    super("login", "logs in to Discord");
  }
  run(cli, args) {
    return cli.bot.start();
  }
}

class HelpCommand extends CLICommand {
  constructor() {
    super("help", "displays help about available commands or details about a given command");
  }
  run(cli, args) {
    if (args.length > 1) {
      // See if there's a command under this name
      let command = cli._commands.get(args[1]);
      if (command) {
        cli.writeLine("Details for the " + args[1] + " command:");
        cli.writeLine();
        command.detailedHelp(cli, args.slice(2));
      } else {
        cli.writeLine(`Unknown command "${args[1]}". Use "help" with arguments to list all commands.`);
      }
      return null;
    }
    cli.writeLine(cli.bot.name + " command line help");
    cli.writeLine("The command line accepts \"special\" commands that override regular bot commands.");
    cli.writeLine("The following commands are understood:");
    cli.writeLine();
    for (let [command, obj] of cli._commands.entries()) {
      console.log("  " + command + " -- " + obj.help);
    }
    console.log();
    return null;
  }
}

function humanizeBytes(count) {
  if (count < 1024) {
    return count + 'B';
  } else if (count < (1024*1024)) {
    return (count / 1024).toFixed(1) + 'KB';
  } else if (count < (1024*1024*1024)) {
    return (count / (1024*1024)).toFixed(1) + 'MB';
  } else {
    return (count / (1024*1024*1024)).toFixed(1) + 'GB';
  }
}

class StatusCommand extends CLICommand {
  constructor() {
    super("status", "shows bot status");
  }
  run(cli, args) {
    cli.writeLine("Status: " + cli.bot.status);
    try {
      let url = cli.bot.getBotJoinURL();
      cli.writeLine("Join URL: " + url);
    } catch (ex) {
      cli.writeLine("Join URL cannot be generated: " + ex);
    }
    cli.writeLine("Memory:");
    let usage = process.memoryUsage();
    cli.writeLine(`  RSS: ${humanizeBytes(usage.rss)}`);
    cli.writeLine(`  Heap: ${humanizeBytes(usage.heapUsed)}/${humanizeBytes(usage.heapTotal)}`);
    cli.writeLine(`  External: ${humanizeBytes(usage.external)}`);
  }
}

class ConfigCommand extends CLICommand {
  constructor() {
    super("config", "allows configuration to be queried");
  }
  run(cli, args) {
    let configuration = cli.bot.configuration;
    if (args.length > 1) {
      // TODO: Allow get/set as "subcommands" to configure a specific configuration value
      // Look up the specific configuration value.
      let k = args[1];
      if (configuration.has(k)) {
        cli.output.writeLine(`${k} = ${this.convertValue(cli, cli.bot.configuration.get(k))}`);
      } else {
        cli.writeLine(`${k} does not have a value assigned`);
      }
    } else {
      cli.writeLine("Configuration currently has values for the following:");
      // configuration.keys() is an iterator and we want to sort the keys:
      let keys = Array.from(configuration.keys());
      keys.sort();
      for (let k of keys) {
        // TODO: Color output?
        cli.output.writeLine(` * ${k} = ${this.convertValue(cli, configuration.get(k))}`);
      }
    }
  }
  /**
   * Writes a value out to the command line.
   * @param {CLI} cli the command line interface to write to
   * @param {*} value the value to write
   */
  convertValue(cli, value) {
    if (typeof value === 'object') {
      // For the most part these values should be simple primitives.
      // For objects, write out the object type, to prevent the output from
      // becoming enormous.
      return Object.prototype.toString.call(value);
    } else {
      // TODO: Prevent this from going over the edge of the line (maybe)
      return JSON.stringify(value);
    }
  }
}

class SayCommand extends CLICommand {
  constructor() {
    super("say", "\"say\" a message to the bot, as if it were from a remote user");
    this.aliases = [ "message", "msg" ];
  }
  run(cli, args, line) {
    // Split off the first token in the line if we can
    let m = /^\s*(\S+)\s*/.exec(line);
    if (m) {
      line = line.substring(m[0].length);
    }
    cli.bot.handleMessage(new mock.CLIMessage(cli.channel, line, cli.user));
  }
}

class EchoCommand extends CLICommand {
  constructor() {
    super("echo", "echo arguments as if they were sent via the bot");
  }
  run(cli, args, line) {
    // Split off the first token in the line if we can
    let m = /^\s*(\S+)\s*/.exec(line);
    if (m) {
      line = line.substring(m[0].length);
    }
    cli.channel.send(line);
  }
}

function logsync(message) {
  fs.writeSync(1, message + "\n");
}

/**
 * This is intended to (eventually) enable better debugging of "what's happening"
 * with various asynchronous requests.
 */
class TraceAsyncCommand extends CLICommand {
  constructor() {
    super("traceasync", "toggles tracing asynchronous handlers");
    this._hook = null;
    this._tracing = false;
    this._known = {};
  }
  run(cli, args) {
    // TODO: Parse args (to turn on/off)
    if (this._hook) {
      if (this._tracing) {
        this._hook.disable();
        this._tracing = false;
        logsync("Async tracing disabled.");
      } else {
        // Console logging is itself asynchronous, so for this:
        logsync("Async tracing enabled.");
        this._hook.enable();
        this._tracing = true;
      }
    } else {
      const async_hooks = require('async_hooks');
      this._hook = async_hooks.createHook(this);
      this._hook.enable();
      this._tracing = true;
      logsync("Async tracing enabled.");
    }
  }
  // NOTE: The callbacks are implemented as class functions, but this will NOT
  // be set when they're invoked.
  init(asyncId, type, triggerAsyncId, resource) {
    logsync(`[ASYNC] ${type}(${asyncId}) trigger: ${triggerAsyncId}`);
  }
  destroy(asyncId) {
    logsync(`[ASYNC] Destroyed ${asyncId}`);
  }
}

/**
 * Writes a heapdump. Requires the heapdump module be installed. If heapdump is
 * not installed, this command will not function (and will be excluded from
 * default commands).
 *
 * See the [heapdump module](https://github.com/bnoordhuis/node-heapdump) for
 * how to use the heapdump.
 */
class HeapDumpCommand extends CLICommand {
  constructor() {
    super("heapdump", "immediately write a heapdump");
  }
  run(cli, args) {
    if (args.length > 1) {
      heapdump.writeSnapshot(args[1]);
    } else {
      heapdump.writeSnapshot();
    }
  }
 detailedHelp(cli, args) {
   cli.writeLine("heapdump [FILE]");
   cli.writeLine("");
   cli.output.writeMarkdown("If given a file, writes a heapdump to that file. Otherwise, writes a heapdump to `heapdump-<sec>.<usec>.heapsnapshot`.");
   cli.output.writeMarkdown("See the node-heapdump documentation at https://github.com/bnoordhuis/node-heapdump for details on how to use this file.");
 }
}

class GarbageCollectCommand extends CLICommand {
  constructor() {
    super("gc", "forces an immediate garbage collection");
  }
  run(cli, args) {
    let beforeUsage = process.memoryUsage();
    cli.writeLine(`Current heap: ${humanizeBytes(beforeUsage.heapUsed)}/${humanizeBytes(beforeUsage.heapTotal)}`);
    cli.writeLine("Starting garbage collection...");
    cli.bot.garbageCollect();
    if (typeof global.gc === 'function') {
      global.gc();
    } else {
      cli.output.writeMarkdown("**Note:** V8 garbage collector was not exposed. (Try running with `--expose-gc`.) V8 GC was skipped.");
    }
    let afterUsage = process.memoryUsage(), message;
    if (beforeUsage.heapUsed > afterUsage.heapUsed) {
      message = `freed ${humanizeBytes(beforeUsage.heapUsed - afterUsage.heapUsed)}`;
    } else {
      message = `increased memory usage by ${humanizeBytes(afterUsage.heapUsed - beforeUsage.heapUsed)} (this may not be a bug, as temp objects may still need to be cleared by the GC)`
    }
    cli.writeLine(`  GC ${message}, heap is now: ${humanizeBytes(afterUsage.heapUsed)}/${humanizeBytes(afterUsage.heapTotal)}`);
  }
}

/**
 * Array of default commands.
 */
exports.DEFAULT_COMMANDS = [
  HelpCommand, StatusCommand, SayCommand, LoginCommand, LogoutCommand,
  ShutdownCommand, EchoCommand, ConfigCommand, TraceAsyncCommand,
  GarbageCollectCommand
];

if (heapdump !== null) {
  exports.DEFAULT_COMMANDS.push(HeapDumpCommand);
}

exports.CLICommand = CLICommand;
exports.HelpCommand = HelpCommand;
exports.StatusCommand= StatusCommand;
exports.ConfigCommand = ConfigCommand;
exports.SayCommand = SayCommand;
exports.LoginCommand = LoginCommand;
exports.LogoutCommand = LogoutCommand;
exports.ShutdownCommand = ShutdownCommand;
exports.EchoCommand = EchoCommand;
exports.TraceAsyncCommand = TraceAsyncCommand;
exports.HeapDumpCommand = HeapDumpCommand;
exports.GarbageCollectCommand = GarbageCollectCommand;
