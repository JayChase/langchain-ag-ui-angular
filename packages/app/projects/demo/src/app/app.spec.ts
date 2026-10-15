import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { Auth } from './auth/auth';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let isCheckingAuthSignal = signal(false);
  let loginRequiredSignal = signal(false);

  const authMock = {
    isCheckingAuth: isCheckingAuthSignal,
    loginRequired: loginRequiredSignal,
    handleRedirectObservable: () => of(null),
    activateAccount: () => undefined,
    logout: () => undefined,
  };

  beforeEach(async () => {
    isCheckingAuthSignal = signal(false);
    loginRequiredSignal = signal(false);
    authMock.isCheckingAuth = isCheckingAuthSignal;
    authMock.loginRequired = loginRequiredSignal;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: Auth, useValue: authMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
  });

  it('should create the app', () => {
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render loading state when checking auth', async () => {
    isCheckingAuthSignal.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-root__auth-loading')).toBeTruthy();
    expect(compiled.querySelector('.app-root__loading-message')?.textContent).toContain(
      'Loading...',
    );
    expect(compiled.querySelector('app-login')).toBeFalsy();
    expect(compiled.querySelector('.app-root__toolbar')).toBeFalsy();
  });

  it('should render login component when login is required', async () => {
    isCheckingAuthSignal.set(false);
    loginRequiredSignal.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-login')).toBeTruthy();
    expect(compiled.querySelector('.app-root__toolbar')).toBeFalsy();
  });

  it('should render toolbar and title when authenticated', async () => {
    isCheckingAuthSignal.set(false);
    loginRequiredSignal.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-root__title')?.textContent).toContain(
      'langchain-ag-ui-angular',
    );
    expect(compiled.querySelector('.app-root__toolbar')).toBeTruthy();
    expect(compiled.querySelector('app-login')).toBeFalsy();
  });
});
