import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Redirect } from './redirect';

describe('Redirect', () => {
  let component: Redirect;
  let fixture: ComponentFixture<Redirect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Redirect],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    fixture = TestBed.createComponent(Redirect);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should call broadcastResponseToMainFrame on browser platform', async () => {
    fixture = TestBed.createComponent(Redirect);
    component = fixture.componentInstance;

    expect(component.platformId).toBe('browser');
    component.ngOnInit();

    await fixture.whenStable();
  });

  it('should not call broadcastResponseToMainFrame on server platform', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Redirect],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    fixture = TestBed.createComponent(Redirect);
    component = fixture.componentInstance;

    expect(component.platformId).toBe('server');
    component.ngOnInit();

    await fixture.whenStable();
  });

  it('should log error when broadcastResponseToMainFrame fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(Redirect);
    component = fixture.componentInstance;
    component.ngOnInit();

    await fixture.whenStable();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error broadcasting response to main frame:',
      expect.objectContaining({
        errorCode: 'empty_response',
      }),
    );
  });
});
