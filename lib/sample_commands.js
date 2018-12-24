"use strict";

/*
 * Various sample commands. These commands are not added by default but can be
 * added.
 */

const Command = require('./commands').Command;

/**
 * A command implementing a classic magic eight ball.
 */
class MagicEightBallCommand extends Command {
  constructor() {
    super("eightball", "ask the magic eight ball a question");
    /**
     * The set of possible answers. Default answers taken from the Wikipedia.
     * @type {Array.<string>}
     */
    this.answers = [
      "It is certain", "It is decidedly so", "Without a doubt",
      "Yes \u2013 definitely", "You may rely on it", "As I see it, yes",
      "Most likely", "Outlook good", "Yes", "Signs point to yes",
      "Reply hazy, try again", "Ask again later", "Better not tell you now",
      "Cannot predict now", "Concentrate and ask again",
      "Don't count on it", "My reply is no", "My sources say no",
      "Outlook not so good", "Very doubtful"
    ];
  }
  runCommand(bot, args, message, line) {
    // This is fairly simple: pick a random answer and tell the user.
    let answer = this.answers[Math.floor(Math.random() * this.answers.length)];
    // TODO: Let the response be customized.
    return `:large_blue_diamond: ${answer}, ${message.author}.`;
  }
}

exports.MagicEightBallCommand = MagicEightBallCommand;

 /**
  * A simple command to implement a dice roller.
  */
class RollCommand extends Command {
  constructor() {
    super("roll", 'roll dice (describe them D&D style like "2d6" to roll two D6es)');
    this.maxDice = 100;
  }

  runCommand(bot, args, message, line) {
    // Our output varies based on arguments.
    let total = 0;
    if (args.length > 1) {
      args.shift();
    } else {
      args = [ "6" ];
    }
    // Limit the total number of dice we'll roll to 100 (to prevent absurd
    // requests like 50000000d6)
    let r = [], dice = this.maxDice;
    for (let arg of args) {
      if (dice > 0) {
        let roll = new DiceRoll(arg, dice);
        dice -= roll.wanted;
        total += roll.total;
        r.push(roll.format());
        if (dice < 0) {
          r.push(`Sorry, but that ran me out of dice, so I couldn't roll all ${roll.wanted}: I only have ${this.maxDice} dice to roll.`)
          break;
        }
      } else {
        if (dice == 0) {
          r.push(`Sorry, I only have ${this.maxDice} dice and can't roll any more.`);
        }
        break;
      }
    }
    if (args.length > 1) {
      r.push(`Total: **${total}**`)
    }
    return r;
  }
}

/**
 * A set of dice rolls. This is used to group dice rolls off a single die type,
 * like 2d6 or 4d4.
 */
class DiceRoll {
  /**
   * Create a new dice roll.
   * @param {!string} description
   *     the dice roll, in traditional D&D style, like `"1d6"` or "d4". If no
   *     sides are given, assumes the number of sides is 6.
   * @param {!number} maxDice
   *     the maximum number of dice to be rolled. For any number of sides past
   *     2, each individual dice needs to be "rolled" to create a proper
   *     distribution. The individual rolls are also included so they have to
   *     be calculated. This places a cap on the total number of rolls so you
   *     can't DDOS a bot by trying to roll a ton of dice. Or you can set this
   *     to Infinity and try rolling 1e100 dice, your choice.
   */
  constructor(description, maxDice) {
    /**
     * The original dice description as given by the user.
     * @type {string}
     */
    this.description = description;
    /**
     * A flag indicating if parsing failed and a D6 was substituted.
     * @type {boolean}
     */
    this.failed = false;
    let m = /^(\d*?)\s*[Dd]?\s*(\d+)$/.exec(description), number = 1, max = 6;
    if (m) {
      // Some form of die string.
      if (m[1])
        number = parseInt(m[1]);
      max = parseInt(m[2]);
    } else {
      max = Math.round(Number(description));
      if (isNaN(max)) {
        // If we couldn't parse the string, just treat it as a D6
        this.failed = true;
        max = 6;
      }
    }
    if (max < 1) {
      this.failed = true;
      max = 6;
    }
    /**
     * The number of sides of the dice rolled.
     * @type {number}
     */
    this.sides = max;
    /**
     * The desired number of dice given by the user. This may be more than
     * maxDice: the actual number of dice rolled is the number of entries in
     * {@link DiceRoll#results}.
     * @type {number}
     */
    this.wanted = number;
    // Cap the number of dice to be rolled
    if (number > maxDice) {
      number = maxDice;
    }
    /**
     * The actual dice results, as an array of numbers.
     */
    this.results = new Array(number);
    for (let i = 0; i < number; i++) {
      this.results[i] = Math.floor(Math.random()*max) + 1;
    }
    /**
     * The result of adding all the dice rolls together.
     */
    this.total = this.results.reduce((a, b) => { return a + b; }, 0);
  }

  /**
   * Formats the roll into Discord Markdown.
   */
  format() {
    let count = this.results.length;
    if (count === 0) {
      // Silly answer for rolling nothing.
      return `:hole: I rolled no D${this.sides}s and got ... well ... nothing.`;
    } else if (this.sides === 1) {
      // Silly answer for a 1-sided die
      return `:one: I ... gathered, I guess? ... ${this.diceDescription()} and got, well, ${count}.`;
    } else if (this.sides === 2) {
      // Special answer for 2-sided dice, which are basically coins.
      if (count === 1) {
        // If we have a single coin, we can call it heads or tails.
        let result = this.total === 1 ? 'heads' : (this.total === 2 ? 'tails' : 'edge');
        return `:game_die: I flipped a coin and got ${result}.`;
      }
      return `:game_die: I flipped ${count === 1 ? 'a coin' : count + ' coins'} and got ${this.formatResults()}.`;
    } else {
      return `:game_die: I rolled ${this.diceDescription()} and got ${this.formatResults()}.`;
    }
  }

  /**
   * Provides a string describing the number and sides of dice rolled.
   */
  diceDescription() {
    if (this.results.length === 1) {
      return `a D${this.sides}`;
    } else {
      return `${this.results.length} D${this.sides}s`;
    }
  }

  /**
   * Formats the results of a roll. For a single roll, this just returns the roll
   * as a string. For multiple results, it returns them and the result of adding
   * them all together.
   */
  formatResults() {
    if (this.results.length == 0) {
      return "nothing";
    } else if (this.results.length == 1) {
      return this.results[0].toString();
    } else {
      return this.results.join(" + ") + " = **" + this.total + "**";
    }
  }
}

RollCommand.DiceRoll = DiceRoll;

exports.RollCommand = RollCommand;
