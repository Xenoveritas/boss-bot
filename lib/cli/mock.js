"use strict";

// Used to write output to STDOUT for traceasync
const fs = require('fs');
const defaultOutput = require('./output');

/**
 * Internal function that implements a Promise that immediately rejects.
 */
function notImplemented() {
  return new Promise((resolve, reject) => {
    reject("Not Implemented");
  });
}

/**
 * Mock Discord user.
 */
function CLIUser(username) {
  if (username)
    this.username = username;
}

CLIUser.prototype = {
  avatar: null,
  get avatarURL() { return null; },
  /**
   * Currently defaults to false.
   */
  bot: false,
  get client() { return null; },
  get createdAt() { return null; },
  get createdTimestamp() { return null; },
  get defaultAvatarURL() { return null; },
  discriminator: "0000", // FIXME: "0000" or "#0000"?
  get displayAvatarURL() { return null; },
  get dmChannel() { return null; }, // FIXME: This might be implementable
  id: null,
  lastMessage: null,
  lastMessageID: null,
  get presence() { return null; }, // TODO: mock this
  get tag() { return null; }, // TODO: mock this
  username: "mockuser",
  createDM: notImplemented,
  deleteDM: notImplemented,
  equals: function(user) {
    return user === this;
  },
  send: notImplemented, // I think this sends to the DM channel?
  typingDurationIn: function(channel) {
    return -1;
  },
  typingIn: function(channel) {
    return false;
  },
  typingSinceIn: function(channel) {
    return null;
  }
}

/**
 * Mock Discord message. This is used when a message comes in from the command
 * line and is handled by bot commands. Such a message isn't a "real" Discord
 * message and therefore has fewer options.
 */
function CLIMessage(channel, content, author) {
  this.channel = channel;
  this.content = content;
  this.author = author;
}

CLIMessage.prototype = {
  attachments: {},
  author: null,
  get clearContent() { return content; },
  get client() { return null; },
  get createdAt() { return null; },
  createdTimestamp: null,
  get deletable() { return false; },
  get editable() { return false; },
  editedTimestamp: null,
  edits: null,
  embeds: null,
  guild: null,
  hit: false,
  id: null,
  member: null,
  mentions: null,
  nonce: null,
  get pinnable() { return false; },
  pinned: false,
  reactions: {},
  system: false,
  tts: false,
  /**
   * The type of the message. This is "cli" which is not a valid Discord message
   * type but is used for CLI messages.
   */
  type: "cli",
  webhookID: null,
  /**
   * Returns a Promise that is immediately rejected.
   */
  acknowledge: notImplemented,
  /**
   * Currently returns a Promise that is immediately rejected. It is unlikely
   * that this will ever be properly implemented but it may eventually become a
   * no-op.
   */
  awaitReactions: notImplemented,
  /**
   * Returns a Promise that is immediately rejected.
   */
  clearReactions: notImplemented,
  /**
   * Throws an error: this is not implemented. Eventually this may be partially
   * implemented as an effective no-op, as the CLI offers no method to add
   * reactions.
   */
  createReactionCollector: function() { throw new Error("Not implemented"); },
  /**
   * Returns a Promise that is immediately rejected.
   */
  delete: notImplemented,
  /**
   * Returns a Promise that is immediately rejected.
   */
  edit: notImplemented,
  /**
   * Returns a Promise that is immediately rejected.
   */
  fetchWebhook: notImplemented,
  /**
   * Not implemented yet.
   */
  isMemberMentioned: function(member) { return false; },
  /**
   * Not implemented yet.
   */
  isMentioned: function(data) { return false; },
  /**
   * Returns a promise that resolves immediately.
   */
  pin: function() { return new Promise((resolve, reject) => { resolve(this); }); },
  /**
   * Returns a promise that resolves immediately (but resolves to null rather
   * than what it's supposed to).
   */
  react: function(emoji) { return new Promise((resolve, reject) => { resolve(null); }); },
  /**
   * Returns a promise that resolves immediately. The message is displayed on
   * the command line.
   */
  reply: function(content, options) {
    if (arguments.length === 1) {
      if (typeof content === 'object') {
        options = content;
        content = '';
      }
    }
    content = '@reply: ' + content;
    return this.channel.send(content, options);
  },
  toString: function() {
    return this.content;
  },
  /**
   * Returns a promise that resolves immediately.
   */
  unpin: function() { return new Promise((resolve, reject) => { resolve(this); }); }
}

/**
 * A mock channel that represents the command line. Provides stubs that allow
 * commands to interact with the command line as if they were interacting with
 * a regular Discord TextChannel.
 */
function CLIChannel(output) {
  this._output = output || defaultOutput;
  this.permissionOverwrites = {};
}

CLIChannel.prototype = {
  get calculatedPosition() { return 0; },
  get deletable() { return false; },
  guild: null,
  lastMessageID: null,
  get members() { return {}; },
  get messageNotifications() { return null; },
  get messages() { return null; },
  get muted() { return null; },
  name: "cli",
  get nsfw() { return false; },
  position: 0,
  topic: "Command Line",
  type: "cli",
  get typing() { return false; },
  get typingCount() { return 0; },
  /**
   * Returns a promise that is immediately rejected.
   */
  acknowledge: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   * FIXME: This should probably be implemented.
   */
  awaitMessages: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  bulkDelete: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  clone: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  createCollector: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  createInvite: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   * FIXME: This should probably be implemented.
   */
  createMessageCollector: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  createWebhook: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  delete: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  edit: notImplemented,
  /**
   * This is implemented as "===".
   */
  equals: function(channel) {
    return this === channel;
  },
  fetchMessage: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  fetchMessages: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  fetchPinnedMessages: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  fetchWebhooks: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  overwritePermissions: notImplemented,
  /**
   * Throws an error. (This may in the future return fake permissions.)
   */
  permissionsFor: function(member) { throw new Error("Not implemented."); },
  /**
   * Returns a promise that is immediately rejected.
   */
  search: notImplemented,
  /**
   * Displays a message to STDOUT. This immediately resolves to a CLIMessage
   * that is the content displayed. Options is currently ignored, but eventually
   * embeds and the like might be supported to some degree.
   */
  send: function(content, options) {
    // If the content is an array, output each line
    if (Array.isArray(content)) {
      content.forEach(line => {
        this._output.writeMarkdown(line);
      });
    } else {
      this._output.writeMarkdown(content);
    }
    if (typeof options === 'object' && options.embed) {
      this._output.writeEmbed(options.embed);
    }
    return new Promise((resolve, reject) => {
      resolve(new CLIMessage(this, content));
    });
  },
  /**
   * Returns a promise that is immediately rejected. (In the future this may be
   * implemented by returns a promise that immediately resolves and sets the
   * title property.)
   */
  setName: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  setPosition: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  setTopic: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  startTyping: notImplemented,
  /**
   * Returns a promise that is immediately rejected.
   */
  stopTyping: notImplemented,
  /**
   * Returns '#' + this.name
   */
  toString: function() {
    return '#' + this.name;
  }
}

exports.CLIUser = CLIUser;
exports.CLIMessage = CLIMessage;
exports.CLIChannel = CLIChannel;
