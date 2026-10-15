import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HaikuTool } from './haiku-tool';

describe('HaikuTool', () => {
  let fixture: ComponentFixture<HaikuTool>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HaikuTool],
    }).compileComponents();
  });

  function renderWithArgs(
    args: { japanese?: string; english?: string } = {},
    status: 'in-progress' | 'executing' | 'complete' = 'complete',
  ): void {
    fixture = TestBed.createComponent(HaikuTool);
    fixture.componentRef.setInput('toolCall', {
      name: 'generate_haiku',
      args,
      status,
      result: status === 'complete' ? 'Haiku displayed.' : undefined,
    });
    fixture.detectChanges();
  }

  it('renders both haiku lines from tool call arguments', () => {
    renderWithArgs({
      japanese: '古池や',
      english: 'Still water holds the sky.',
    });

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('[data-testid="haiku-japanese-line"]')?.textContent).toContain(
      '古池や',
    );
    expect(native.querySelector('[data-testid="haiku-english-line"]')?.textContent).toContain(
      'Still water holds the sky.',
    );
  });

  it('shows waiting state when in-progress with no args', () => {
    renderWithArgs({}, 'in-progress');

    const native = fixture.nativeElement as HTMLElement;
    expect(native.textContent).toContain('Writing haiku...');
  });
});
