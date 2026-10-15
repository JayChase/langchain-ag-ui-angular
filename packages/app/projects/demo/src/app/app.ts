import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { BrowserUtils } from '@azure/msal-browser';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, startWith } from 'rxjs/operators';
import { Auth } from './auth/auth';
import { Login } from './login/login';

/**
 * Root application component responsible for shell navigation and top-level auth gating.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Login],
  template: `
    @if (!isIframe()) {
      @if (!isRedirectRoute() && !isLoginFailedRoute() && isCheckingAuth()) {
        <div class="app-root__auth-loading" role="status" aria-live="polite">
          <p class="app-root__loading-message">Loading...</p>
        </div>
      } @else if (loginRequired()) {
        <app-login></app-login>
      } @else {
        <header class="app-root__toolbar" role="toolbar" aria-label="Application toolbar">
          <a class="app-root__title" href="/">langchain-ag-ui-angular</a>

          <div class="app-root__toolbar-spacer"></div>

          <div class="app-root__menu-wrapper">
            <button
              type="button"
              class="app-root__toolbar-button app-root__toolbar-button--icon"
              aria-label="User account menu"
              aria-haspopup="menu"
              [attr.aria-expanded]="logoutMenuToggle()"
              aria-controls="logout-menu"
              (click)="toggleLogoutMenu()"
            >
              <span class="material-icons" aria-hidden="true">person</span>
            </button>
            @if (logoutMenuToggle()) {
              <ul id="logout-menu" role="menu" class="app-root__menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    class="app-root__menu-item"
                    (click)="logout()"
                  >
                    Logout
                  </button>
                </li>
              </ul>
            }
          </div>
        </header>
        <div class="app-root__container">
          <router-outlet></router-outlet>
        </div>
      }
    }
  `,
  host: {
    class: 'app-root dark',
  },
  styles: [
    `
      :host {
        height: 100%;
        display: grid;
        grid-template-rows: auto 1fr;
        grid-template-columns: 1fr;
      }

      .app-root {
        &__auth-loading {
          align-items: center;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          min-height: 100vh;
          padding: 1.5rem;
        }

        &__loading-message {
          color: var(--color-accent);
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
          text-align: center;
        }

        &__container {
          display: block;
        }

        &__toolbar {
          align-items: center;
          background-color: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
        }

        &__title {
          color: var(--color-accent);
          font-size: 1.1rem;
          font-weight: 700;
          text-decoration: none;
        }

        &__toolbar-spacer {
          flex: 1;
        }

        &__toolbar-button {
          background: transparent;
          border: 1px solid var(--color-border-accent);
          border-radius: 0.375rem;
          color: var(--color-accent);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          padding: 0.375rem 0.625rem;
          text-decoration: none;
          transition: background-color 0.15s ease-in-out;
        }

        &__toolbar-button:hover {
          background-color: rgba(0, 240, 255, 0.1);
        }

        &__toolbar-button--icon {
          align-items: center;
          border-radius: 50%;
          justify-content: center;
          padding: 0.375rem;
        }

        &__toolbar-button--icon .material-icons {
          font-size: 1.25rem;
          line-height: 1;
        }

        &__toolbar-button:focus-visible,
        &__menu-item:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        &__menu-wrapper {
          position: relative;
        }

        &__menu {
          background-color: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          list-style: none;
          margin: 0.5rem 0 0;
          min-width: 13rem;
          padding: 0.25rem;
          position: absolute;
          right: 0;
          top: 100%;
          z-index: 20;
        }

        &__menu-item {
          background: transparent;
          border: 0;
          border-radius: 0.25rem;
          color: var(--color-text);
          cursor: pointer;
          display: block;
          font: inherit;
          padding: 0.45rem 0.55rem;
          text-align: left;
          width: 100%;
        }

        &__menu-item:hover {
          background-color: rgba(255, 0, 127, 0.15);
        }
      }
    `,
  ],
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly isIframe = signal(false);
  readonly logoutMenuToggle = signal(false);

  readonly isCheckingAuth = this.auth.isCheckingAuth;
  readonly loginRequired = this.auth.loginRequired;

  readonly isLoginFailedRoute = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects.startsWith('/auth-failed')),
      startWith(this.router.url.startsWith('/auth-failed')),
    ),
    { initialValue: this.router.url.startsWith('/auth-failed') },
  );

  readonly isRedirectRoute = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects.startsWith('/redirect')),
      startWith(this.router.url.startsWith('/redirect')),
    ),
    { initialValue: this.router.url.startsWith('/redirect') },
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isIframe.set(BrowserUtils.isInIframe() && !window.opener);

      this.auth
        .handleRedirectObservable()
        .pipe(
          catchError(() => EMPTY),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.auth.activateAccount());
    }
  }

  logout() {
    this.auth.logout();
  }

  toggleLogoutMenu() {
    this.logoutMenuToggle.update((isOpen) => !isOpen);
  }
}
