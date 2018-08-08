const assert = require('assert'),
  sinon = require('sinon'),
  Bot = require('../lib/bot'),
  PromiseMock = require('promise-mock'),
  Command = require('../lib/commands').Command,
  mocks = require('./mock/mocks');

describe('Bot', () => {
  describe('constructor', () => {
    it('should create a blank bot with no arguments', () => {
      let bot = new Bot();
    });
  });

  describe('handleMessage', function() {
    let clock;
    beforeEach(function() {
      PromiseMock.install();
      clock = sinon.useFakeTimers();
    });

    it("should enforce a global cooldown for a user", function() {
      let bot = new Bot();
      let commandFunc = sinon.spy();
      let user = new mocks.MockUser();
      let channel = new mocks.MockChannel();
      bot.addCommand(new Command("test", commandFunc));
      // Basically, send the same message three times in a row with various
      // (fake) delays, ensuring that it's ignored if it's too fast.
      bot.handleMessage(new mocks.MockMessage(bot.prefix + " test", channel, user));
      assert(commandFunc.calledOnce);
      // Move forward a second.
      clock.tick(1000);
      bot.handleMessage(new mocks.MockMessage(bot.prefix + " test", channel, user));
      // And make sure this isn't invoked a second time.
      assert(commandFunc.calledOnce);
      // And now wait out the cooldown and make sure it is.
      clock.tick(5000);
      bot.handleMessage(new mocks.MockMessage(bot.prefix + " test", channel, user));
      assert(commandFunc.calledTwice);
    });

    it("should enforce a global cooldown for a channel", function() {
      let bot = new Bot();
      let commandFunc = sinon.spy();
      let channel = new mocks.MockChannel();
      bot.addCommand(new Command("test", commandFunc));
      // Basically, send the same message twice in a row.
      bot.handleMessage(new mocks.MockMessage(bot.prefix + " test", channel));
      assert(commandFunc.calledOnce);
      // Channel cooldown is very short.
      clock.tick(100);
      bot.handleMessage(new mocks.MockMessage(bot.prefix + " test", channel));
      // And make sure this isn't invoked a second time.
      assert(commandFunc.calledOnce);
      // And now wait out the cooldown and make sure it is.
      clock.tick(500);
      bot.handleMessage(new mocks.MockMessage(bot.prefix + " test", channel));
      assert(commandFunc.calledTwice);
    });

    afterEach(function() {
      clock.restore();
      PromiseMock.uninstall();
    });
  });
});
