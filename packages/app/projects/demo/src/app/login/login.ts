import { Component, inject } from '@angular/core';
import { Auth } from '../auth/auth';

/**
 * Login presentation component providing centered Entra ID sign-in entry point.
 */
@Component({
  imports: [],
  selector: 'app-login',
  template: `
    <main class="login">
      <div class="login__card">
        <h1 class="login__title">Sign in with your entra account</h1>
        <button type="button" class="login__button login__button--primary" (click)="login()">
          Sign in
        </button>
      </div>
    </main>
  `,
  styles: `
    .login {
      align-items: center;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }

    .login__card {
      align-items: center;
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      max-width: 24rem;
      padding: 2rem;
      text-align: center;
      width: 100%;
    }

    .login__title {
      color: var(--color-text);
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1.3;
      margin: 0;
    }

    .login__button {
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-size: 1rem;
      font-weight: 600;
      justify-content: center;
      min-width: 10rem;
      padding: 0.75rem 1.5rem;
      transition: background-color 0.15s ease-in-out;
    }

    .login__button--primary {
      background-color: var(--color-primary);
      color: var(--color-primary-fg);
    }

    .login__button--primary:hover {
      background-color: var(--color-primary-hover);
    }

    .login__button--primary:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class Login {
  private readonly auth = inject(Auth);

  login(): void {
    this.auth.login();
  }
}
