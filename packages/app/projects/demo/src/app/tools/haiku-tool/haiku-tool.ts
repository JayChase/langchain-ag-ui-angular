import { Component, inject, input, linkedSignal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import type { HaikuResult } from 'schemas';

@Component({
  selector: 'app-haiku-tool',
  template: `
    <article class="haiku" data-testid="haiku-card">
      @let call = toolCall();
      @switch (call.status) {
        @case ('in-progress')
        @case ('executing') {
          <p class="haiku__status">Writing haiku...</p>
        }
        @case ('complete') {
          <p class="haiku__line" data-testid="haiku-japanese-line">{{ call.args.japanese }}</p>
          <p class="haiku__line" data-testid="haiku-english-line">{{ call.args.english }}</p>
          @if (sumiE()) {
            <div class="haiku__sumiE" [innerHTML]="sumiE()"></div>
          }
        }
      }
    </article>
  `,
  styles: `
    @import url('https://fonts.googleapis.com/css2?family=Zen+Old+Mincho&display=swap');

    .haiku {
      border: 3px solid #90785a;
      border-radius: 12px;
      color: #231300;
      padding: 1rem;
      background-color: #deba6c;
      background-image:
        radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(139, 101, 59, 0.22) 100%),
        radial-gradient(circle at 18% 24%, rgba(160, 120, 75, 0.12) 0%, transparent 45%),
        radial-gradient(circle at 82% 78%, rgba(145, 105, 60, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 75% 15%, rgba(175, 135, 80, 0.08) 0%, transparent 35%),
        repeating-linear-gradient(
          0deg,
          rgba(120, 85, 45, 0.02) 0px,
          rgba(120, 85, 45, 0.02) 1px,
          transparent 1px,
          transparent 3px
        ),
        linear-gradient(135deg, #f6efe0 0%, #ede0c4 50%, #e2cfab 100%);
      box-shadow: 0 8px 20px rgb(17 24 39 / 0.12);
    }

    .haiku__title,
    .haiku__status,
    .haiku__line {
      font-family: 'Zen Old Mincho', serif;
      font-size: 22px;
      line-height: 1.25;
      margin: 0.25rem 0;
    }
  `,
})
export class HaikuTool implements ToolRenderer<HaikuResult> {
  private readonly domSanitizer = inject(DomSanitizer);
  readonly toolCall = input.required<AngularToolCall<HaikuResult>>();
  readonly sumiE = linkedSignal(() => {
    const sumiE = this.toolCall().args.sumiE;
    return sumiE ? this.domSanitizer.bypassSecurityTrustHtml(sumiE) : undefined;
  });
}
