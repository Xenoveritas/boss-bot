// This requires mocking actual dependencies.
const rewiremock = require('rewiremock').default,
  sinon = require('sinon'),
  assert = require('assert');

describe('console output', function() {
  describe('ConsoleOutput', function() {
    let fakeFS;
    beforeEach(function() {
      rewiremock.enable();
      // We need a "special" fs that traps write attempts without actually writing them.
      fakeFS = {
        writeSync: sinon.spy()
      };
      rewiremock('fs').with(fakeFS);
    });
    describe('without termkit', function() {
      let out;
      beforeEach(function() {
        rewiremock('terminal-kit').with(null);
        out = new (require('../../lib/cli/output').ConsoleOutput)();
      });
      it("should be able to write text", function() {
        out.write("This works");
        assert(fakeFS.writeSync.getCall(0).calledWithExactly(1, "This"));
        assert(fakeFS.writeSync.getCall(1).calledWithExactly(1, " "));
        assert(fakeFS.writeSync.getCall(2).calledWithExactly(1, "works"));
      });
      it("should write multiple lines if given a string with newlines", function() {
        out.write("Line1\nLine2\nLine3\n");
        assert(fakeFS.writeSync.getCall(0).calledWithExactly(1, "Line1"));
        assert(fakeFS.writeSync.getCall(1).calledWithExactly(1, "\n"));
        assert(fakeFS.writeSync.getCall(2).calledWithExactly(1, "Line2"));
        assert(fakeFS.writeSync.getCall(3).calledWithExactly(1, "\n"));
        assert(fakeFS.writeSync.getCall(4).calledWithExactly(1, "Line3"));
        assert(fakeFS.writeSync.getCall(5).calledWithExactly(1, "\n"));
      });
    });
    afterEach(function() {
      rewiremock.disable();
    });
  });
});
