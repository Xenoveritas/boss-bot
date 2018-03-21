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

/**
 * Generic console output that uses `process.stdout` to write text.
 */
class ConsoleOutput {
  constructor() {
    this._offset = 0;
    this._prefix = null;
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
   * Write Markdown. The console output does not do any Markdown parsing, but
   * does wrap to 80 columns.
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
      let w = termkit.stringWidth(token);
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
  writeLine(text) {
    if (arguments.length > 0) {
      this.write(text);
    } else if (this._offset === 0) {
      this._writePrefix();
    }
    fs.writeSync(1, "\n");
    this._offset = 0;
  }
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

class TerminalOutput {
  constructor(t) {
    this.terminal = arguments.length > 0 ? t : terminal;
    this._offset = 0;
    this._prefix = null;
    this.prefixRed = 255;
    this.prefixGreen = 255;
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
