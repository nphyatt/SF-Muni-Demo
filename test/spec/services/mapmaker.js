'use strict';

describe('Service: MapMaker', function () {

  // load the service's module
  beforeEach(module('eyesOnSfApp'));

  // instantiate service
  var MapMaker;
  beforeEach(inject(function (_MapMaker_) {
    MapMaker = _MapMaker_;
  }));

  it('should do something', function () {
    expect(!!MapMaker).toBe(true);
  });

});
