import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MsalService } from '@azure/msal-angular';
import {
  CopilotChat,
  CopilotKit,
  provideCopilotChatLabels,
  registerRenderToolCall,
} from '@copilotkit/angular';
import { concat, delay, filter, mergeMap, Observable, of, startWith, switchMap } from 'rxjs';
import { HaikuResultSchema } from 'schemas';
import { environment } from '../../environments/environment';
import { Auth } from '../auth/auth';
import { InsightsService } from '../insights/insights';
import { HaikuTool } from '../tools/haiku-tool/haiku-tool';

@Component({
  selector: 'app-chat',
  imports: [CopilotChat],
  providers: [
    provideCopilotChatLabels({
      chatInputPlaceholder: 'Ask me to write a haiku to see a frontend tool in action...',
      welcomeMessageText: 'Welcome to the LangGraph / ag-ui / Angular demo',
    }),
  ],
  template: ` @if (isBrowser() && authReady()) {
      <copilot-chat class="app-chat__copilot-chat" />
      @if (toasts(); as error) {
        <div
          class="app-chat__toast"
          aria-live="polite"
          aria-atomic="true"
          animate.enter="app-chat__toast--entering"
          animate.leave="app-chat__toast--leaving"
        >
          <output role="status" class="app-chat__toast-message">{{ error.message }}</output>
        </div>
      }
    } @else {
      <h2 class="app-chat__placeholder">loading chat...</h2>
    }`,
  host: {
    class: 'app-chat',
  },
  styles: `
    :host {
      display: grid;
      grid-template-rows: 1fr;
      grid-template-columns: 1fr;
      height: 100%;
      overflow: clip;
    }

    .app-chat {
      &__copilot-chat {
        grid-row: 1;
        grid-column: 1;
      }
      &__placeholder {
        place-self: center;
      }
      &__toast {
        background-color: var(--color-surface);
        padding: 12px 36px;
        z-index: 999;
        grid-row: 1;
        grid-column: 1;
        align-self: end;
        justify-self: center;

        &--entering {
          animation: toast-enter 300ms ease-out;
        }

        &--leaving {
          animation: toast-leave 300ms ease-in;
        }
      }
    }

    @keyframes toast-enter {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes toast-leave {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }
  `,
})
export class Chat {
  protected readonly platformId = inject(PLATFORM_ID);
  protected readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));
  protected readonly auth = inject(Auth);
  protected readonly copilotKit = inject(CopilotKit);
  protected readonly msalService = inject(MsalService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly insights = inject(InsightsService);

  authReady = signal<boolean>(false);

  copilotKitErrors$ = new Observable<Error>((subscriber) => {
    const subscription = this.copilotKit.core.subscribe({
      onError: ({ error }) => {
        this.insights.trackException(error);
        subscriber.next(error);
      },
    });

    return () => subscription.unsubscribe();
  });

  toasts = toSignal(
    this.copilotKitErrors$.pipe(mergeMap((error) => concat(of(error), of(null).pipe(delay(4000))))),
  );

  constructor() {
    registerRenderToolCall({
      name: 'generate_haiku',
      args: HaikuResultSchema,
      component: HaikuTool,
    });

    afterNextRender(() => {
      this.copilotKitErrors$
        .pipe(
          filter((error) => error.message.includes('401')),
          startWith(new Error('no token')),
          switchMap(() => this.auth.chatApiToken$),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (authResult) => {
            const headers = { ...this.copilotKit.headers() };

            headers['Authorization'] = `Bearer ${authResult.accessToken}`;

            // set runtimeUrl together with the auth header so no unauthenticated connection is ever attempted
            this.copilotKit.updateRuntime({ runtimeUrl: environment.chatApi.uri, headers });
            this.authReady.set(true);
          },
          error: (error) => {
            this.insights.trackException(error instanceof Error ? error : new Error(String(error)));
          },
        });
    });
  }
}
