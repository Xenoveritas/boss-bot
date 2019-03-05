const assert = require('assert'),
  prefix = require('../lib/prefix');

describe('prefix', function() {
  describe('PREFIX_WHOLE_WORD', function() {
    describe('match', function() {
      it('should return the string minus the prefix', function() {
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', 'test    a command', 'en'), '    a command');
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', '    test with excess space', 'en'), ' with excess space');
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', 'test', 'en'), '');
      });
      it('should return null with no prefix', function() {
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', '', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', '  ', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', '    ', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', '        ', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.match('test', 'a string with test prefix but without it first', 'en'), null);
      });
    });
    describe('format', function() {
      it('should prepend prefix', function() {
        assert.strictEqual(prefix.PREFIX_WHOLE_WORD.format('test', 'command', 'en'), 'test command');
      });
    });
  });
  describe('PREFIX_WITH_COMMAND', function() {
    describe('match', function() {
      it('should return the string minus the prefix', function() {
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', 'testa command', 'en'), 'a command');
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', '      test with excess space', 'en'), ' with excess space');
      });
      it('should return null with no prefix', function() {
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', '', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', '  ', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', '    ', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', '        ', 'en'), null);
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.match('test', 'a string with test prefix but without it first', 'en'), null);
      });
    });
    describe('format', function() {
      it('should prepend prefix', function() {
        assert.strictEqual(prefix.PREFIX_WITH_COMMAND.format('test', 'command', 'en'), 'testcommand');
      });
    });
  });
});