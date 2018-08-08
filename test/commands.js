const assert = require('assert'),
  sinon = require('sinon'),
  commands = require('../lib/commands'),
  mocks = require('./mock/mocks'),
  PromiseMock = require('promise-mock');

const Command = commands.Command;

describe('Commands', function() {
  describe('Command', function() {
    it('should handle a command that immediately executes', () => {
      let command = new Command('test', function() { return "Executes immediately"; });
      let message = new mocks.MockMessage('test');
      // Should generate a promise, don't care about the resolution.
      message.channel.send = sinon.fake.resolves(true);
      command.run(null, [ 'test' ], message, 'test');
      assert.equal('Executes immediately', message.channel.send.lastArg);
    });
    it("should handle a command that doesn't send a response", () => {
      let command = new Command('test', function() { return null; });
      let message = new mocks.MockMessage('test');
      // Should generate a promise, don't care about the resolution.
      message.channel.send = sinon.spy();
      command.run(null, [ 'test' ], message, 'test');
      assert(message.channel.send.notCalled);
    });
    describe('when receiving Promises', function() {
      let clock;
      beforeEach(function() {
        clock = sinon.useFakeTimers(mocks.DISCORD_EPOCH);
        PromiseMock.install();
      });

      it('should handle a command that returns a Promise that immediately resolves', () => {
        // This test doesn't really need fake timers but whatever.
        let command = new Command('test', function() { return Promise.resolve("Resolved promise"); });
        let message = new mocks.MockMessage('test');
        // Should generate a promise, don't care about the resolution.
        message.channel.send = sinon.fake.resolves(true);
        command.run(null, [ 'test' ], message, 'test').then(() => {
          assert.equal('Resolved promise', message.channel.send.lastArg);
        });
        Promise.run();
      });

      it('should handle a command that returns a Promise that takes a while to resolve', function() {
        // This test requires fake timers to unravel.
        let command = new Command('test', function() {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve("Delayed resolve!");
            }, 1000);
          });
        });
        let message = new mocks.MockMessage('test');
        // Pre-create the mock message so we can test it.
        let testMessage = new mocks.MockMessage(null, message.channel);
        testMessage.edit = sinon.stub().resolves(testMessage);
        message.channel.send = sinon.spy(function(content) {
          testMessage.content = content;
          return Promise.resolve(testMessage);
        });
        command.run(null, [ 'test' ], message, 'test');
        clock.runAll();
        Promise.runAll();
        assert(message.channel.send.calledOnceWith("Please wait, loading..."));
        assert(testMessage.edit.calledOnceWith("Delayed resolve!"));
      });

      it('should handle a command that returns a Promise that resolves before the loading message resolves', function() {
        // This test requires fake timers to unravel.
        let command = new Command('test', function() {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve("Delayed resolve!");
            }, 1000);
          });
        });
        let message = new mocks.MockMessage('test');
        // Pre-create the mock loading message so we can test it.
        let testMessage = new mocks.MockMessage(null, message.channel);
        testMessage.edit = sinon.stub().resolves(testMessage);
        // What this does is delay the resolving of the Promise until AFTER
        // the original command resolves.
        message.channel.send = sinon.spy(function(content) {
          testMessage.content = content;
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(testMessage);
            }, 1500);
          });
        });
        // Other than being delayed, this should function similarly to the above
        command.run(null, [ 'test' ], message, 'test').then();
        clock.runAll();
        Promise.runAll();
        assert(message.channel.send.calledOnceWith("Please wait, loading..."));
        assert(testMessage.edit.calledOnceWith("Delayed resolve!"));
      });

      it('should delay invoking edit if a Promise resolves immediately after it sends a message', function() {
        // This test is very time-sensitive, and requires fake timers to ensure
        // that the timing really happens as necessary and isn't
        // environment-dependent.
        let command = new Command('test', function() {
          // This needs to "happen" 300ms after it is invoked, so it's after
          // the "time to show loading message" timeout but BEFORE the "safe
          // to edit loading message" timeout.
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve("Badly timed resolve!");
            }, 300);
          });
        });
        let message = new mocks.MockMessage('test');
        // Pre-create the mock message so we can test it.
        let testMessage = new mocks.MockMessage(null, message.channel);
        testMessage.edit = sinon.stub().resolves(testMessage);
        message.channel.send = sinon.spy(function(content) {
          testMessage.content = content;
          return Promise.resolve(testMessage);
        });
        command.run(null, [ 'test' ], message, 'test');
        clock.next();
        // Should cause the loading message to be sent.
        assert(message.channel.send.calledOnceWith("Please wait, loading..."));
        Promise.run();
        clock.next();
        // Should indicate that the NEXT message has been received, but should
        // NOT trigger the edit
        assert(message.channel.send.calledOnce);
        assert(testMessage.edit.notCalled);
        // Need to pump Promises again to resolve the command.
        Promise.runAll();
        clock.next();
        // And this should trigger the edit.
        assert(message.channel.send.calledOnce);
        assert(testMessage.edit.calledOnceWith("Badly timed resolve!"));
      });

      afterEach(function() {
        clock.restore();
        PromiseMock.uninstall();
      });
    });

    describe('when dealing with cooldowns', function() {
      // This isn't implemented yet
      it("should not handle a second request made too soon after another");
    });
  });
});
