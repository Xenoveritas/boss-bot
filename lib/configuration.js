"use strict";

/**
 * This module provides a simple configuration class that defines a basic API
 * for looking up configuration values. The default simply pulls values out of
 * a Map.
 */

/**
 * Loads a JSON-style object into a configuration, making keys dot-separated.
 * Mostly useful for generating a flat map of values.
 */
function loadJSON(prefix, obj, configuration) {
  if (typeof obj === 'object') {
    for (let k in obj) {
      let v = obj[k];
      if (typeof v === 'object' && v !== null && v !== undefined) {
        if (Array.isArray(v)) {
          // Arrays should be stored directly.
          configuration.set(prefix + k, v);
        } else {
          // Recurse into
          loadJSON(prefix + k + '.', v, configuration);
        }
      } else {
        configuration.set(prefix + k, v);
      }
    }
  }
}

/**
 * Basic configuration class. This stores values in an internal Map, but can
 * be extended to pull and store data to a file or other place. Note that
 * configuration access is expected to be synchronous - values should all be
 * available almost instantly. This is different from a persistent store, which
 * is expected to be accessed asynchronously.
 */
class Configuration {
  /**
   * Create a new configuration with the given values.
   */
  constructor(json) {
    this._values = new Map();
    if (json) {
      loadJSON('', json, this);
    }
  }

  /**
   * Merges this configuration with a different configuration.
   */
  merge(configuration) {
    if (!configuration)
      return;
    if (typeof configuration.keys !== 'function' || typeof configuration.get !== 'function') {
      configuration = new Configuration(configuration);
    }
    for (let key of configuration.keys()) {
      this.set(key, configuration.get(key));
    }
  }

  /**
   * Gets a configuration value. Returns the defaultValue if the value is not
   * set in the configuration anywhere.
   */
  get(key, defaultValue) {
    if (this._values.has(key)) {
      return this._values.get(key);
    } else {
      return defaultValue;
    }
  }

  /**
   * Gets a configuration value for a given context. Context may be a Message,
   * a Channel, a Guild, or a User. Messages are recommended. The lookup order
   * is:
   *
   * 1. Guild/Channel/Sender:
   *    `guilds.<guild id>.channels.<channel id>.users.<sender id>.<key>`
   *    (only if given a Message). This is sort of useless as channel IDs are
   *    globally unique, but it's included because it makes the configuration
   *    file make more sense, as it allows you to group channel configuration
   *    within a guild's configuration.
   * 2. Channel/Sender: `channels.<channel id>.users.<sender id>.<key>` (only
   *    if given a Message)
   * 3. Guild/Sender: `guilds.<guild id>.users.<sender id>.<key>` (only if
   *    given a Message)
   * 4. User alone: `users.<user id>.<key>` (only if given a Message or User)
   * 5. Guild/Channel: `guilds.<guild id>.channels.<channel id>.<key>`
   *    (only if given a Message). This is sort of useless as channel IDs are
   *    globally unique, but it's included because it makes the configuration
   *    file make more sense, as it allows you to group channel configuration
   *    within a guild's configuration.
   * 5. Channel alone: `channels.<channel id>.<key>` (only if given a Message or
   *    Channel)
   * 6. Guild alone: `guilds.<guild id>.<key>` (only if given a Message or
   *    Guild)
   * 7. Defaults: `defaults.<key>` (if all else failed)
   */
  getConfig(context, key, defaultValue) {
    let author = null, channel = null, guild = null;
    // Our definition of "Message" is "something that has an author with an ID
    // and a channel with an ID"
    if ('author' in context && 'id' in context.author) {
      author = context.author;
    }
    if ('channel' in context && 'id' in context.channel) {
      channel = context.channel;
      if ('guild' in channel && 'id' in channel.guild) {
        guild = channel.guild;
      }
    } else if ('guild' in context && 'id' in context) {
      // We assume anything with an ID and a guild is a channel.
      channel = context;
      if ('id' in context.guild) {
        guild = context.guild;
      }
    } else if ('region' in context && 'id' in context) {
      // We assume anything with an ID and a region is a guild.
      guild = context;
    } else if ('avatar' in context && 'id' in context) {
      // We assume anything with an avatar and an ID is a user.
      author = context;
    }
    // And here is the horrible cascade through keys
    if (guild && channel && author) {
      let k = `guilds.${guild.id}.channels.${channel.id}.users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (channel && author) {
      let k = `channels.${channel.id}.users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (guild && author) {
      let k = `guilds.${guild.id}.users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (author) {
      let k = `users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (guild && channel) {
      let k = `guilds.${guild.id}.channels.${channel.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (channel) {
      let k = `channels.${channel.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (guild) {
      let k = `guilds.${guild.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    return this.get(`defaults.${key}`, defaultValue);
  }

  /**
   * Determine if there is a mapped value for a given key. This is used by
   * {@link #getConfig} to lookup whether specific items have user-specific,
   * channel-specific, or guild-specific values.
   */
  has(key) {
    return this._values.has(key);
  }

  /**
   * Get all configuration keys.
   */
  keys() {
    return this._values.keys();
  }

  /**
   * Sets a configuration value. By default the value is not persisted anywhere.
   */
  set(key, value) {
    this._values.set(key, value);
  }
}

module.exports = Configuration;
