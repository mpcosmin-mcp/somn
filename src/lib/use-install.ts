'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * Centralized PWA-install state.
 *
 *   • Chromium browsers (Chrome, Edge, Brave, Samsung Internet…) fire
 *     `beforeinstallprompt` when the install criteria are met. We capture
 *     the event and store it so the UI can trigger the native prompt on
 *     user click.
 *   • iOS Safari does not support that event. Detect iOS+Safari outside
 *     of standalone mode → expose `iosHint = true` so the UI can show a
 *     "Apasă Share → Add to Home Screen" banner instead.
 *   • Already-installed users (running in `display-mode: standalone`)
 *     get the whole install UI suppressed.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const TOAST_KEY = 'somn_install_toast_dismissed';

export interface InstallState {
  /** Chromium prompt is available and not yet consumed */
  canInstall: boolean;
  /** App is already running as installed PWA */
  isStandalone: boolean;
  /** iOS Safari (no native prompt) — show manual hint */
  iosHint: boolean;
  /** True until the user dismisses the toast (persists in localStorage) */
  toastVisible: boolean;
  /** Trigger the native install prompt (no-op on iOS) */
  install: () => Promise<void>;
  /** Hide the toast and remember the dismissal */
  dismissToast: () => void;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua);
  // Safari (not Chrome on iOS which is also WebKit) — match anything
  // that's NOT explicitly another browser.
  const safari = /^((?!CriOS|FxiOS|EdgiOS|OPiOS).)*Safari/.test(ua);
  return iOS && safari;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS-specific flag
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function useInstall(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIosHint(detectIos());
    try {
      setToastDismissed(localStorage.getItem(TOAST_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferred(null);
      }
    } catch (err) {
      console.warn('[somn] install prompt failed', err);
    }
  }, [deferred]);

  const dismissToast = useCallback(() => {
    setToastDismissed(true);
    try {
      localStorage.setItem(TOAST_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  return {
    canInstall: !!deferred,
    isStandalone,
    iosHint: iosHint && !isStandalone,
    toastVisible: !toastDismissed && (!!deferred || (iosHint && !isStandalone)),
    install,
    dismissToast,
  };
}
