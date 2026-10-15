import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MSAL_GUARD_CONFIG,
  MsalBroadcastService,
  MsalGuardConfiguration,
  MsalService,
} from '@azure/msal-angular';
import {
  AuthenticationResult,
  EventMessage,
  EventType,
  InteractionStatus,
  RedirectRequest,
} from '@azure/msal-browser';
import { of } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  take,
} from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { isNotNullish } from '../utils/is-not-nullish';

/**
 * Authentication service wrapping MSAL Angular and Entra ID authentication flows.
 */
@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly msalService = inject(MsalService);
  private readonly broadcastService = inject(MsalBroadcastService);
  private readonly guardConfig = inject<MsalGuardConfiguration>(MSAL_GUARD_CONFIG);

  /** Emits when MSAL has finished all in-flight interaction and is idle. */
  readonly ready$ = this.broadcastService.inProgress$.pipe(
    filter((status) => status === InteractionStatus.None),
  );

  /** Stream indicating whether an MSAL interaction or initial startup check is active. */
  readonly isCheckingAuth$ = this.broadcastService.inProgress$.pipe(
    map((status) => status !== InteractionStatus.None),
    startWith(true),
    distinctUntilChanged(),
  );

  /** Stream emitting true when at least one authenticated account is cached and ready. */
  readonly isAuthenticated$ = this.ready$.pipe(
    map(() => this.msalService.instance.getAllAccounts().length > 0),
    distinctUntilChanged(),
  );

  /** Stream emitting true when the auth check is complete and no active accounts exist. */
  readonly loginRequired$ = this.ready$.pipe(
    map(() => this.msalService.instance.getAllAccounts().length === 0),
    distinctUntilChanged(),
  );

  /** Signal reflecting whether initial auth resolution or interaction is in progress. */
  readonly isCheckingAuth = toSignal(this.isCheckingAuth$, { initialValue: true });
  /** Signal reflecting whether the current user is authenticated. */
  readonly isAuthenticated = toSignal(this.isAuthenticated$, { initialValue: false });
  /** Signal reflecting whether login is required. */
  readonly loginRequired = toSignal(this.loginRequired$, { initialValue: false });

  /** Active account display name, or null when unauthenticated. */
  readonly displayName$ = this.ready$.pipe(
    map(() => this.msalService.instance.getActiveAccount()?.name ?? null),
  );

  readonly acquireTokenFailure$ = this.broadcastService.msalSubject$.pipe(
    filter((msg: EventMessage) => msg.eventType === EventType.ACQUIRE_TOKEN_FAILURE),
  );

  handleRedirectObservable() {
    return this.msalService.handleRedirectObservable();
  }

  login() {
    if (this.guardConfig.authRequest) {
      this.msalService.loginRedirect({ ...this.guardConfig.authRequest } as RedirectRequest);
    } else {
      this.msalService.loginRedirect();
    }
  }

  logout() {
    this.msalService.logoutRedirect();
  }

  activateAccount() {
    const accounts = this.msalService.instance.getAllAccounts();
    if (!this.msalService.instance.getActiveAccount() && accounts.length > 0) {
      this.msalService.instance.setActiveAccount(accounts[0]);
    }
  }

  chatApiToken$ = this.isAuthenticated$.pipe(
    filter((isAuthenticated) => !!isAuthenticated),
    take(1),
    map(() => this.msalService.instance.getActiveAccount()),
    filter((account) => !!account),

    switchMap((account) =>
      this.msalService.acquireTokenSilent({
        account,
        scopes: environment.chatApi.scopes,
      }),
    ),
    catchError(() => of(null)),
    filter((authResult) => isNotNullish<AuthenticationResult>(authResult)),
  );
}
