import { Routes } from '@angular/router';
import { AuthFailed } from './auth-failed/auth-failed';
import { Chat } from './chat/chat';
import { Redirect } from './redirect/redirect';

export const routes: Routes = [
  { path: '', component: Chat },
  {
    path: 'redirect',
    component: Redirect,
  },
  {
    path: 'auth-failed',
    component: AuthFailed,
  },
];
