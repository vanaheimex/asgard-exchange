import { TestBed } from '@angular/core/testing';

import { SwapServiceService } from './swap-service.service';

describe('SwapServiceService', () => {
  let service: SwapServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SwapServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
