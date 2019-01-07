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
 * Bot configuration class. This stores configuration values that can be
 * retrieved at run time. The values are generally expected to not change
 * frequently. Listeners can be added to the configuration object in order to
 * allow callbacks to know when a value changes.
 *
 * There are two ways to request a configuration value: with a context, in which
 * case there is a lookup hierarchy that determines where the value is pulled
 * from, or without, in which case it always comes from the global pool.
 *
 * Use {@linkcode Configuration#get|get()} to get a configuration value from the
 * global defaults and {@linkcode Configuration#getConfig|getConfig()} to get a
 * configuration value that is scoped to a specific context.
 */
class Configuration {
  /**
   * Create a new configuration with the given values.
   *
   * If given an object, the object's keys are used to populate the
   * configuration. These values are "flattened."
   *
   * @param {object} [json]
   *     an object to use to populate the configuration values
   */
  constructor(json) {
    this._values = new Map();
    if (json) {
      loadJSON('', json, this);
    }
  }

  /**
   * Merges this configuration with a different configuration.
   *
   * @param {!(Configuration|object)} configuration
   *     the configuration to merge
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
   * Gets a configuration value, or a default if the configuration variable is
   * not set. This does not have a context and is a "raw" lookup.
   *
   * @param {!string} key
   *     the key to look up a value for
   * @param {*} [defaultValue]
   *     the value to return if nothing has a value for this key (defaults to
   *     `undefined`)
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
   *
   * @param {?(Discord.User|Discord.Channel|Discord.Message)} context
   *     the context of the key being looked up, or `null` if there is no
   *     context (which will use the default value)
   * @param {!string} key
   *     the key to look up a value for
   * @param {*} [defaultValue]
   *     the value to return if nothing has a value for this key (or `undefined`
   *     if not given)
   */
  getConfig(context, key, defaultValue) {
    let author = null, channel = null, guild = null, k;
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
      k = `guilds.${guild.id}.channels.${channel.id}.users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (channel && author) {
      k = `channels.${channel.id}.users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (guild && author) {
      k = `guilds.${guild.id}.users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (author) {
      k = `users.${author.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (guild && channel) {
      k = `guilds.${guild.id}.channels.${channel.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (channel) {
      k = `channels.${channel.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    if (guild) {
      k = `guilds.${guild.id}.${key}`;
      if (this.has(k))
        return this.get(k);
    }
    return this.get(`defaults.${key}`, defaultValue);
  }

  /**
   * Determine if there is a mapped value for a given key. This is used by
   * {@linkcode Configuration#getConfig|getConfig()} to lookup whether specific
   * items have user-specific, channel-specific, or guild-specific values.
   *
   * @param {string} key
   *     the key to check
   * @return {boolean}
   *     whether the key has a value set
   */
  has(key) {
    return this._values.has(key);
  }

  /**
   * Get all configuration keys.
   *
   * @return {Iterator}
   *     iterator over the configuration keys
   */
  keys() {
    return this._values.keys();
  }

  /**
   * Sets a configuration value. By default the value is not persisted anywhere.
   *
   * @param {!string} key
   *     the key to set
   * @param {*} value
   *     the value to set
   */
  set(key, value) {
    this._values.set(key, value);
  }
}

module.exports = Configuration;
