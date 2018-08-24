var utils = require('../lib/utils.js');
describe("Test utils", function () {
  it("should be empty", function (done) {
    utils.should.eql({});
    done();
  });
});