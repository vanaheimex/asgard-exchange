import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportPhraseComponent } from './import-phrase.component';

describe('ImportPhraseComponent', () => {
  let component: ImportPhraseComponent;
  let fixture: ComponentFixture<ImportPhraseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportPhraseComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportPhraseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
