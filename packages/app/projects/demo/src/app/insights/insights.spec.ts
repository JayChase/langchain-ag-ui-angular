import { Platform } from '@angular/cdk/platform';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsightsService } from './insights';
import { provideInsights } from './provide-insights';

describe('InsightsService', () => {
  let service: InsightsService;
  let platformMock: { isBrowser: boolean };

  beforeEach(() => {
    platformMock = { isBrowser: false };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Platform,
          useValue: platformMock,
        },
        provideInsights({
          connectionString: 'InstrumentationKey=test-key',
          logLevel: 'error',
        }),
      ],
    });

    service = TestBed.inject(InsightsService);
  });

  it('should be created and register as ErrorHandler', () => {
    expect(service).toBeTruthy();
    const errorHandler = TestBed.inject(ErrorHandler);
    expect(errorHandler).toBe(service);
  });

  it('should delegate handleError to trackException and logError', () => {
    const logErrorSpy = vi.spyOn(service, 'logError');
    const trackExceptionSpy = vi.spyOn(service, 'trackException');
    const testError = new Error('boom');

    service.handleError(testError);

    expect(trackExceptionSpy).toHaveBeenCalledWith(testError, {
      rawError: service.safeStringify(testError),
    });
    expect(logErrorSpy).toHaveBeenCalledWith('ng error', { error: testError }, 'error');
  });

  it('should normalize non-Error values in handleError', () => {
    const trackExceptionSpy = vi.spyOn(service, 'trackException');

    service.handleError('string-failure');

    expect(trackExceptionSpy).toHaveBeenCalledWith(expect.any(Error), {
      rawError: '"string-failure"',
    });
  });

  it('should log warning when logLevel is warn or information', () => {
    service.logLevel = 'warn';
    const logErrorSpy = vi.spyOn(service, 'logError');

    service.warn('warning-event', { detail: 123 });

    expect(logErrorSpy).toHaveBeenCalledWith('warning-event', { detail: 123 }, 'warn');
  });

  it('should not log warning when logLevel is error', () => {
    service.logLevel = 'error';
    const logErrorSpy = vi.spyOn(service, 'logError');

    service.warn('warning-event', { detail: 123 });

    expect(logErrorSpy).not.toHaveBeenCalled();
  });

  it('should log info when logLevel is information', () => {
    service.logLevel = 'information';
    const logErrorSpy = vi.spyOn(service, 'logError');

    service.info('info-event', { detail: 'abc' });

    expect(logErrorSpy).toHaveBeenCalledWith('info-event', { detail: 'abc' }, 'information');
  });

  it('should safely stringify complex values', () => {
    expect(service.safeStringify({ a: 1 })).toBe('{"a":1}');
    expect(service.safeStringify(null)).toBe('');
  });
});
