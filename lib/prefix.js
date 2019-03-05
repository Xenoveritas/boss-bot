// Handles various prefix matching/formatting
"use strict";

/**
 * Prefix is a separate word, so if the prefix is `"bot"`, then the strings
 * `"bot hello"` and `"  bot   hello"` would trigger the bot but `"bothello"`
 * would not.
 */
exports.PREFIX_WHOLE_WORD = {
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
 * Prefix is before the command, so if the prefix is `"!"`, then `"!hello"`
 * would trigger the command `"hello"` while just `"hello"` would be ignored.
 * `"! hello"` would trigger a "blank command" with the arguments
 * `[ "hello" ]`. (See {@linkcode Bot#blankCommand|Bot.blankCommand()}.)
 */
exports.PREFIX_WITH_COMMAND = {
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