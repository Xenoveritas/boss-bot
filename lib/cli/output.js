/**
 * Module for outputting text to the console. Potentially supports Markdown,
 * if terminal-kit is installed.
 */

"use strict";

const termkit = (function() {
  try {
    return require('terminal-kit');
  } catch (ex) {
    return null;
  }
})();
const terminal = termkit === null ? null : termkit.terminal;
const fs = require('fs');

/**
 * Internal function to determine the width of a string. If `termkit` is
 * available, uses that.
 * @private
 */
let stringWidth = termkit === null ? (str => { return str.length; })
  : termkit.stringWidth;

/**
 * Generic console output that uses `process.stdout` to write text.
 */
class ConsoleOutput {
  /**
   * Create a new console output object.
   */
  constructor() {
    this._offset = 0;
    this._prefix = null;
  }
  /**
   * Property that contains the current line width of the console, if known.
   * Defaults to 80 if it can't be looked up on the current platform.
   * @type {number}
   */
  get lineWidth() {
    return 80;
  }
  get prefix() {
    return this._prefix;
  }
  /**
   * Sets a prefix to append before each written line. Used mostly by the embed
   * writer to write an embed, but can be used anywhere. Since
   * {@linkcode ConsoleOutput#write|write()} attempts to wrap lines, this will
   * appear before each new line.
   * @type {string}
   */
  set prefix(prefix) {
    if (typeof prefix === 'undefined')
      prefix = null;
    else if (prefix !== null) {
      prefix = prefix.toString();
      if (prefix.length === 0)
        prefix = null;
    }
    this._prefix = prefix;
  }
  /**
   * Write Markdown. The console output does not do any Markdown parsing, but
   * does wrap text to {@linkcode ConsoleOutput#lineWidth|lineWidth} characters.
   *
   * @param {string} markdown
   *     the Markdown to write
   */
  writeMarkdown(markdown) {
    this.writeLine(markdown);
  }
  /**
   * Write text to the terminal, attempting to wrap it and including the prefix
   * if the line wraps.
   */
  write(text) {
    if (this._offset === 0 && this._prefix !== null) {
      this._writePrefix();
    }
    if (typeof text !== 'string') {
      // make it a string.
      text = text.toString();
    }
    let tokens = text.split(/(\s+)/);
    const width = 80;
    for (let token of tokens) {
      let w = stringWidth(token);
      if (w > width - this._offset) {
        // Wrap.
        fs.writeSync(1, "\n");
        this._writePrefix();
        if (/^\s*$/.test(token)) {
          // ignore all-space tokens when moving to a new line
          continue;
        }
      }
      fs.writeSync(1, token);
      this._offset += w;
    }
  }
  /**
   * Writes a line of text, always moving on to the next line.
   * {@linkcode ConsoleOutput#write|write()} will not move on to the next line
   * unless given a newline. Note that this always moves on to a new line at
   * the end: calling it with `"\n"` will advance output two lines, one of the
   * newline in the argument, and one at the end.
   *
   * @param {string} text
   *     the text to write
   */
  writeLine(text) {
    if (arguments.length > 0) {
      this.write(text);
    } else if (this._offset === 0) {
      this._writePrefix();
    }
    fs.writeSync(1, "\n");
    this._offset = 0;
  }
  /**
   * Writes out the {@linkcode ConsoleOutput#prefix|prefix}, if there is one.
   *
   * @private
   */
  _writePrefix() {
    if (this._prefix !== null) {
      fs.writeSync(1, this._prefix);
      this._offset = this._prefix.length;
    } else {
      this._offset = 0;
    }
  }
  /**
   * Write embed. This generic output class writes the various parts of the
   * embed in a text form designed to make them readable, but otherwise
   * there's nothing special about it. This does not attempt to implement
   * "inline" fields.
   *
   * @param {Discord.RichEmbed} embed
   *     the embed to write
   */
  writeEmbed(embed) {
    this.prefix = " | ";
    if (embed.title) {
      this.writeLine(embed.title);
    }
    if (embed.url) {
      this.writeLine("(" + embed.url + ")");
    }
    if (embed.title || embed.url) {
      // Only write this if we've written anything
      this.writeLine();
    }
    if (embed.description) {
      this.writeMarkdown(embed.description + "\n");
    }
    if (Array.isArray(embed.fields)) {
      let width = embed.fields.reduce((width, field) => {
        return Math.max(width, field.name.length);
      }, 0);
      embed.fields.forEach(field => {
        this.write(field.name.padStart(width) + ": ");
        this.writeMarkdown(field.value);
      });
    }
    // TODO:
    //  - timestamp
    //  - footer
    //  - image
    //  - thumbnail
    //  - video
    //  - provider
    //  - author
    //  - file
    this.prefix = null;
  }
}

/**
 * Enhancement of {@link ConsoleOutput} that uses `terminal-kit` to better handle
 * console output. This provides for features like "proper" Markdown handling
 * and better line wrapping.
 * 
 * Note that this class will **only** be available if `terminal-kit` is
 * installed. Otherwise this will not be exported.
 */
class TerminalOutput {
  /**
   * @param {terminal-kit.terminal} t
   *     the terminal to use
   */
  constructor(t) {
    this.terminal = arguments.length > 0 ? t : terminal;
    this._offset = 0;
    this._prefix = null;
    /**
     * Red RGB color component to use for a prefix (for colored output).
     * @type {number}
     */
    this.prefixRed = 255;
    /**
     * Green RGB color component to use for a prefix (for colored output).
     * @type {number}
     */
    this.prefixGreen = 255;
    /**
     * Blue RGB color component to use for a prefix (for colored output).
     * @type {number}
     */
    this.prefixBlue = 255;
  }
  get prefix() {
    return this._prefix;
  }
  set prefix(prefix) {
    if (typeof prefix === 'undefined')
      prefix = null;
    else if (prefix !== null) {
      prefix = prefix.toString();
      if (prefix.length === 0)
        prefix = null;
    }
    this._prefix = prefix;
  }
  /**
   * Write Markdown. This will attempt to parse it and wrap it into the
   * console.
   *
   * @param {string} markdown
   *     the Markdown to write
   */
  writeMarkdown(markdown) {
    markdown = markdown.replace(/\*\*(.*?)\*\*/, (m, s) => {
      return this.terminal.bold.noFormat.str(s);
    });
    markdown = markdown.replace(/\*(.*?)\*/, (m, s) => {
      return this.terminal.italic.noFormat.str(s);
    });
    markdown = markdown.replace(/__(.*?)__/, (m, s) => {
      return this.terminal.underline.noFormat.str(s);
    });
    markdown = markdown.replace(/`(.*?)`/, (m, s) => {
      // Technically this should be "fixed width" which ... it already is, so
      // instead dim it to match Discord's styling.
      return this.terminal.dim.noFormat.str(s);
    });
    this.writeLine(markdown);
  }
  /**
   * Writes a line of text that attempts to wrap to the terminal. This **does**
   * allow string formatting sequences - these sequences are not counted
   * as part of the string. This assumes that the offset has been reset on
   * newlines, which will be true as long as write is used to write text.
   *
   * @param {string} text
   *     the text to write
   */
  write(text) {
    if (this._offset === 0 && this._prefix !== null) {
      this._writePrefix();
    }
    if (typeof text !== 'string') {
      if (text === null || typeof text === 'undefined') {
        text = Object.prototype.toString.call(text);
      }
      text = text.toString();
    }
    let tokens = text.split(/(\s+)/), width = this.terminal.width;
    if (isNaN(width))
      width = 80;
    for (let token of tokens) {
      let w = termkit.stringWidth(token);
      if (w > width - this._offset) {
        // Wrap.
        this.terminal("\n");
        this._writePrefix();
        if (/^\s*$/.test(token)) {
          // ignore all-space tokens when moving to a new line
          continue;
        }
      }
      this.terminal.noFormat(token);
      this._offset += w;
    }
  }
  /**
   * Writes a line of text, including the newline.
   *
   * @param {string} text
   *     the text to write
   */
  writeLine(text) {
    if (arguments.length > 0) {
      this.write(text);
    } else if (this._offset === 0) {
      this._writePrefix();
    }
    this.terminal("\n");
    this._offset = 0;
  }
  _writePrefix() {
    if (this._prefix !== null) {
      this.terminal.colorRgb(this.prefixRed, this.prefixGreen, this.prefixBlue).noFormat(this._prefix);
      this.terminal.defaultColor();
      this._offset = termkit.stringWidth(this._prefix);
    } else {
      this._offset = 0;
    }
  }
  /**
   * Write embed. This generic output class writes the various parts of the
   * embed in a text form designed to make them readable, but otherwise
   * there's nothing special about it. This does not attempt to implement
   * "inline" fields.
   *
   * @param {Discord.RichEmbed} embed
   *     the embed to write
   */
  writeEmbed(embed) {
    this.prefix = " | ";
    if (embed.color) {
      this.prefixRed = (embed.color & 0xFF0000) >> 16;
      this.prefixGreen = (embed.color & 0x00FF00) >> 8;
      this.prefixBlue = embed.color & 0x0000FF;
    }
    if (embed.title) {
      this.writeLine(this.terminal.bold.noFormat.str(embed.title));
    }
    if (embed.url) {
      this.writeLine("(" + this.terminal.underline.noFormat.str(embed.url) + ")");
    }
    if (embed.title || embed.url) {
      // Only write this if we've written anything
      this.writeLine();
    }
    if (embed.description) {
      this.writeMarkdown(embed.description + "\n");
    }
    if (Array.isArray(embed.fields)) {
      let width = embed.fields.reduce((width, field) => {
        return Math.max(width, field.name.length);
      }, 0);
      embed.fields.forEach(field => {
        this.write(this.terminal.bold.noFormat.str(field.name.padStart(width)) + ": ");
        this.writeMarkdown(field.value);
      });
    }
    // TODO:
    //  - timestamp
    //  - footer
    //  - image
    //  - thumbnail
    //  - video
    //  - provider
    //  - author
    //  - file
    this.prefix = null;
  }
}

const defaultOutput = terminal === null ? new ConsoleOutput() : new TerminalOutput();

module.exports = defaultOutput;

defaultOutput.ConsoleOutput = ConsoleOutput;
if (terminal !== null)
  defaultOutput.TerminalOutput = TerminalOutput;
