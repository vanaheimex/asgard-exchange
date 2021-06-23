import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoolListItemComponent } from './pool-list-item.component';

describe('PoolListItemComponent', () => {
  let component: PoolListItemComponent;
  let fixture: ComponentFixture<PoolListItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PoolListItemComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PoolListItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
