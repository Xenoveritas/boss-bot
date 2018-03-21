#!/usr/bin/env node

/**
 * This is a very generic starter script that provides an example of what
 * starting a bot would look like. Actually launching a bot like this will
 * create a very bare skeleton that isn't capable of much.
 */

"use strict";

const Bot = require('./lib/bot');

new Bot().startCLI();
