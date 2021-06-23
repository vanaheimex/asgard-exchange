import { TestBed } from '@angular/core/testing';

import { HasUserGuard } from './has-user.guard';

describe('HasUserGuard', () => {
  let guard: HasUserGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(HasUserGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
