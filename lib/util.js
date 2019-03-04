"use strict";

/*
 * Various utility methods.
 */


/**
 * Utility function for parsing a Discord permission. Expects a string.
 * @private
 */
exports.parsePermission = function(permission) {
  if (permission in Discord.Permissions.FLAGS) {
    return Discord.Permission.FLAGS[permission];
  } else {
    throw new Error("Unknown Discord permission \"" + permission + "\"");
  }
}

/**
 * Determine if a given string could be a snowflake. This doesn't check that the
 * snowflake is even remotely valid, just that it could be.
 * @param {string} str the string to check
 */
function isSnowflake(str) {
  return /^[0-9]{1,20}$/.test(str);
}

/**
 * Converts any object to a snowflake, if possible. Basically this checks to
 * see if the object has an ID field that is a snowflake and returns that. If
 * the given object already is a snowflake, returns it immediately.
 *
 * @param {*} obj the object to convert
 * @return {string} the snowflake version of the object or `null` if it isn't an
 *     object with a snowflake
 */
function convertToSnowflake(obj) {
  if (typeof obj === 'string') {
    if (isSnowflake(obj)) {
      return obj;
    }
  } else if (typeof obj === 'number') {
    // If it's an integer, assume it was a snowflake
    let snowflake = Math.floor(obj);
    if (snowflake === obj)
      return snowflake;
  } else if (typeof obj === 'object') {
    if ('id' in obj && typeof obj.id === 'string') {
      if (isSnowflake(obj.id)) {
        return obj.id;
      }
    }
  }
  return null;
}

exports.isSnowflake = isSnowflake;
exports.convertToSnowflake = convertToSnowflake;

/**
 * Convert an incoming object to snowflakes. This always returns an array of
 * everything that could be converted to a snowflake.
 */
exports.convertToSnowflakes = function(obj) {
  // First see if we can convert this directly.
  let snowflake = convertToSnowflake(obj);
  if (snowflake !== null) {
    return [ snowflake ];
  }
  // If the object is null/undefined or a string (and we're here) then it's not
  // a snowflake and we should return an empty array.
  if (obj == null || typeof obj === 'string') {
    return [ ];
  }
  // Since we've gotten rid of strings and null/undefined, let's see if this
  // thing can be iterated
  if (typeof obj[Symbol.iterator] === 'function') {
    let result = [];
    for (let o of obj) {
      let snowflake = convertToSnowflake(o);
      if (snowflake !== null)
        result.push(snowflake);
    }
    return result;
  } else {
    // Otherwise, just assume it's not a Discord object or a snowflake.
    return [ ];
  }
}