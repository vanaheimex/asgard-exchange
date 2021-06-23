import { TestBed } from '@angular/core/testing';

import { PhraseConfirmService } from './phrase-confirm.service';

describe('PhraseConfirmService', () => {
  let service: PhraseConfirmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PhraseConfirmService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
