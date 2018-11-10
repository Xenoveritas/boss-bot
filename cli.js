#!/usr/bin/env node

/**
 * This is a very generic starter script that provides an example of what
 * starting a bot would look like. Actually launching a bot like this will
 * create a very bare skeleton that isn't capable of much.
 */

"use strict";

const Bot = require('./lib/bot');

// Create bot with some default parameters (note that it's missing the
// configuration required to actually connect to the server).
let bot = new Bot({
  prefix: "bot"
});

bot.addBasicCommands();
bot.addSampleCommands();
bot.startCLI();
