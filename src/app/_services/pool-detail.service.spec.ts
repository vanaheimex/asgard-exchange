import { TestBed } from '@angular/core/testing';

import { PoolDetailService } from './pool-detail.service';

describe('PoolDetailService', () => {
  let service: PoolDetailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PoolDetailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
