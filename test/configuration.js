const assert = require('assert'),
  Configuration = require('../lib/configuration');

describe('Configuration', () => {
  describe('constructor', () => {
    it('should merge all default values into one large map', () => {
      let config = new Configuration({
        'nested': {
          'objects': {
            'should': {
              'collapse': true
            }
          }
        }
      });
      assert.equal(config.get('nested.objects.should.collapse'), true);
    });
  });
  describe('#getConfig', () => {
    let config = new Configuration({
      guilds: {
        '1': {
          channels: {
            '2': {
              users: {
                '3': {
                  test: 'guild/channel/sender'
                }
              },
              test: 'guild/channel'
            }
          },
          test: 'guild'
        },
        users: {
          '3': {
            test: 'guild/sender'
          }
        }
      },
      channels: {
        '2': {
          users: {
            '3': {
              test: 'channel/sender'
            }
          }
        },
        test: 'channel'
      },
      users: {
        '3': {
          test: 'sender'
        }
      },
      defaults: {
        test: 'defaults'
      }
    });
    let mockGuild = { id: '1', region: true },
      mockChannel = { id: '2' },
      mockUser = { id: '3', avatar: true };
    let mockMessage = {
      author: mockUser,
      channel: mockChannel
    };
    mockChannel.guild = mockGuild;
    it('should get config from a message', () => {
      assert.equal(config.getConfig(mockMessage, 'test'), 'guild/channel/sender');
    });
    it('should get config from a channel', () => {
      assert.equal(config.getConfig(mockChannel, 'test'), 'guild/channel');
    });
    it('should get config from a guild', () => {
      assert.equal(config.getConfig(mockGuild, 'test'), 'guild');
    });
    it('should get config from a user', () => {
      assert.equal(config.getConfig(mockUser, 'test'), 'sender');
    });
  });
  describe('#merge', () => {
    it("should merge a JSON object", () => {
      let config = new Configuration({ test: 'a', other: 'b' });
      config.merge({test: 'merged'});
      assert.equal(config.get('test'), 'merged');
      assert.equal(config.get('other'), 'b');
    })
  });
});
