/**
 * Test mocks.
 */

/**
 * When the "Discord Epoch" began.
 */
const DISCORD_EPOCH = 1420070400000;

let snowfakeIncrement = 0;
/**
 * Creates a snowfake: a fake snowflake. (So that's not a typo! It's a pun!)
 */
function createSnowfake() {
  let now = new Date().getTime() - DISCORD_EPOCH;
  return ((now << 23) | (snowfakeIncrement++)).toString();
}

class MockChannel {
  constructor() {
    this.id = createSnowfake();
  }

  send(content, options) {
    // TODO: Deal with options.
    return Promise.resolve(new MockMessage(content, this));
  }
}

class MockMessage {
  constructor(content, channel) {
    this.id = createSnowfake();
    this.content = content;
    this.channel = channel ? channel : new MockChannel();
  }

  edit(content, options) {
    // TODO: Deal with options
    this.content = content;
    return Promise.resolve(this);
  }
}

module.exports = {
  DISCORD_EPOCH: DISCORD_EPOCH,
  createSnowfake: createSnowfake,
  createSnowflake: function() { console.log("Stop hating fun (snowfake is a joke, not a typo)"); return createSnowfake(); },
  MockChannel: MockChannel,
  MockMessage: MockMessage
};
