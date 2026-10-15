import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Auth } from '../auth/auth';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let loginSpy: () => void;

  beforeEach(async () => {
    loginSpy = () => undefined;

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        {
          provide: Auth,
          useValue: {
            login: () => loginSpy(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render bold intro text', () => {
    const heading = fixture.nativeElement.querySelector('.login__title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Sign in with your entra account');
  });

  it('should render primary login button and call login on click', () => {
    let clicked = false;
    loginSpy = () => {
      clicked = true;
    };

    const button: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('.login__button--primary');
    expect(button).toBeTruthy();
    expect(button?.classList.contains('login__button')).toBe(true);
    expect(button?.textContent?.trim()).toBe('Sign in');

    button?.click();
    expect(clicked).toBe(true);
  });
});
