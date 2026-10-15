import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthFailed } from './auth-failed';

describe('AuthFailed', () => {
  let component: AuthFailed;
  let fixture: ComponentFixture<AuthFailed>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthFailed],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthFailed);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render failure message', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const paragraph = compiled.querySelector('p');

    expect(paragraph).toBeTruthy();
    expect(paragraph?.textContent).toContain('Login failed. Please try again.');
  });
});
