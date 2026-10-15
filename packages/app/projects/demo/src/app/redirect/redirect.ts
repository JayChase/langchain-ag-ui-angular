import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

@Component({
  selector: 'app-redirect',
  imports: [],
  template: `<p>Processing authentication...</p>`,
  styles: ``,
})
export class Redirect implements OnInit {
  readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Call broadcastResponseToMainFrame when component initializes
      broadcastResponseToMainFrame().catch((error: Error) => {
        console.error('Error broadcasting response to main frame:', error);
      });
    }
  }
}
