import { TestBed } from '@angular/core/testing';

import { RuneYieldService } from './rune-yield.service';

describe('RuneYieldService', () => {
  let service: RuneYieldService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RuneYieldService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
