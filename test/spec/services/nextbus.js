'use strict';

describe('Service: NextBus', function () {

  // load the service's module
  beforeEach(module('eyesOnSfApp'));

  // instantiate service
  var NextBus;
  beforeEach(inject(function (_NextBus_) {
    NextBus = _NextBus_;
  }));

  it('should do something', function () {
    expect(!!NextBus).toBe(true);
  });

});
