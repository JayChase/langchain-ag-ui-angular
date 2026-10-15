import { TestBed } from '@angular/core/testing';
import { MSAL_GUARD_CONFIG, MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { EventType, InteractionStatus } from '@azure/msal-browser';
import { Subject, firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import { Auth } from './auth';

describe('Auth', () => {
  let service: Auth;
  let inProgress$: Subject<InteractionStatus>;
  let msalSubject$: Subject<unknown>;

  let msalServiceMock: {
    instance: {
      getAllAccounts: ReturnType<typeof vi.fn>;
      getActiveAccount: ReturnType<typeof vi.fn>;
      setActiveAccount: ReturnType<typeof vi.fn>;
    };
    handleRedirectObservable: ReturnType<typeof vi.fn>;
    loginRedirect: ReturnType<typeof vi.fn>;
    logoutRedirect: ReturnType<typeof vi.fn>;
    acquireTokenSilent: ReturnType<typeof vi.fn>;
  };

  let msalBroadcastServiceMock: {
    inProgress$: Subject<InteractionStatus>;
    msalSubject$: Subject<unknown>;
  };

  let guardConfig: { authRequest?: { scopes: string[] } };

  beforeEach(() => {
    inProgress$ = new Subject<InteractionStatus>();
    msalSubject$ = new Subject<unknown>();

    msalServiceMock = {
      instance: {
        getAllAccounts: vi.fn().mockReturnValue([]),
        getActiveAccount: vi.fn().mockReturnValue(null),
        setActiveAccount: vi.fn(),
      },
      handleRedirectObservable: vi.fn().mockReturnValue(of(null)),
      loginRedirect: vi.fn(),
      logoutRedirect: vi.fn(),
      acquireTokenSilent: vi.fn().mockReturnValue(of({ accessToken: 'token' })),
    };

    msalBroadcastServiceMock = {
      inProgress$,
      msalSubject$,
    };

    guardConfig = {};

    TestBed.configureTestingModule({
      providers: [
        Auth,
        { provide: MsalService, useValue: msalServiceMock },
        { provide: MsalBroadcastService, useValue: msalBroadcastServiceMock },
        { provide: MSAL_GUARD_CONFIG, useValue: guardConfig },
      ],
    });

    service = TestBed.inject(Auth);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should set ready$ when interaction status is None', async () => {
    const readyPromise = firstValueFrom(service.ready$);

    inProgress$.next(InteractionStatus.None);

    const status = await readyPromise;
    expect(status).toBe(InteractionStatus.None);
  });

  it('should expose isCheckingAuth stream and signal', async () => {
    expect(service.isCheckingAuth()).toBe(true);

    const isCheckingPromise = new Promise<boolean>((resolve) => {
      service.isCheckingAuth$.subscribe((checking) => {
        if (!checking) {
          resolve(checking);
        }
      });
    });

    inProgress$.next(InteractionStatus.None);
    const isChecking = await isCheckingPromise;
    expect(isChecking).toBe(false);
  });

  it('should emit true for isAuthenticated$ when accounts exist', async () => {
    msalServiceMock.instance.getAllAccounts.mockReturnValue([{ username: 'test@user.com' }]);

    const authPromise = firstValueFrom(service.isAuthenticated$);
    inProgress$.next(InteractionStatus.None);

    const isAuthenticated = await authPromise;
    expect(isAuthenticated).toBe(true);
  });

  it('should emit true for loginRequired$ when no accounts exist', async () => {
    const loginRequiredPromise = firstValueFrom(service.loginRequired$);
    inProgress$.next(InteractionStatus.None);

    const loginRequired = await loginRequiredPromise;
    expect(loginRequired).toBe(true);
  });

  it('should emit displayName$ from active account', async () => {
    msalServiceMock.instance.getActiveAccount.mockReturnValue({
      username: 'test@user.com',
      name: 'Test User',
    });

    const displayNamePromise = firstValueFrom(service.displayName$);
    inProgress$.next(InteractionStatus.None);

    const displayName = await displayNamePromise;
    expect(displayName).toBe('Test User');
  });

  it('should filter acquireTokenFailure$ events', async () => {
    const failurePromise = firstValueFrom(service.acquireTokenFailure$);

    msalSubject$.next({ eventType: EventType.ACQUIRE_TOKEN_SUCCESS });
    msalSubject$.next({ eventType: EventType.ACQUIRE_TOKEN_FAILURE });

    const event = (await failurePromise) as { eventType: EventType };
    expect(event.eventType).toBe(EventType.ACQUIRE_TOKEN_FAILURE);
  });

  it('should handle redirect observable', async () => {
    const result = await firstValueFrom(service.handleRedirectObservable());
    expect(msalServiceMock.handleRedirectObservable).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should call loginRedirect with authRequest when present', () => {
    guardConfig.authRequest = { scopes: ['user.read'] };
    service.login();

    expect(msalServiceMock.loginRedirect).toHaveBeenCalledWith({
      scopes: ['user.read'],
    });
  });

  it('should call loginRedirect without authRequest when absent', () => {
    service.login();
    expect(msalServiceMock.loginRedirect).toHaveBeenCalledWith();
  });

  it('should call logoutRedirect', () => {
    service.logout();
    expect(msalServiceMock.logoutRedirect).toHaveBeenCalled();
  });

  it('should activate account when none is active', () => {
    msalServiceMock.instance.getAllAccounts.mockReturnValue([{ username: 'test@user.com' }]);
    msalServiceMock.instance.getActiveAccount.mockReturnValue(null);

    service.activateAccount();

    expect(msalServiceMock.instance.setActiveAccount).toHaveBeenCalledWith({
      username: 'test@user.com',
    });
  });

  it('should emit chatApiToken$ when authenticated', async () => {
    msalServiceMock.instance.getAllAccounts.mockReturnValue([{ username: 'test@user.com' }]);
    msalServiceMock.instance.getActiveAccount.mockReturnValue({ username: 'test@user.com' });
    msalServiceMock.instance.getActiveAccount.mockReturnValue({ username: 'test@user.com' });

    const tokenPromise = firstValueFrom(service.chatApiToken$);
    inProgress$.next(InteractionStatus.None);

    const tokenResult = await tokenPromise;
    expect(tokenResult).toEqual({ accessToken: 'token' });
    expect(msalServiceMock.acquireTokenSilent).toHaveBeenCalledWith({
      account: { username: 'test@user.com' },
      scopes: environment.chatApi.scopes,
    });
  });
});
