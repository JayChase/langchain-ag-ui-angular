import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MsalService } from '@azure/msal-angular';
import { provideCopilotKit } from '@copilotkit/angular';
import { of } from 'rxjs';
import { Auth } from '../auth/auth';
import { InsightsService } from '../insights/insights';
import { Chat } from './chat';

describe('Chat', () => {
  let component: Chat;
  let fixture: ComponentFixture<Chat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chat],
      providers: [
        provideCopilotKit({
          runtimeUrl: 'http://localhost:8000',
        }),
        {
          provide: Auth,
          useValue: {
            chatApiToken$: of({ accessToken: 'mock-token' }),
          },
        },
        {
          provide: MsalService,
          useValue: {},
        },
        {
          provide: InsightsService,
          useValue: { trackException: () => {} },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Chat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
