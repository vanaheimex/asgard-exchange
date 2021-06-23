import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DoubleAssetFieldComponent } from './double-asset-field.component';

describe('DoubleAssetFieldComponent', () => {
  let component: DoubleAssetFieldComponent;
  let fixture: ComponentFixture<DoubleAssetFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DoubleAssetFieldComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DoubleAssetFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
