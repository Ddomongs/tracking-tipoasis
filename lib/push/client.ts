/** Browser-side helpers for the 통관 완료 알림 (11월 28일 요청). No server imports. */

export type PushSupport = "ready" | "iosNeedsHomeScreen" | "unsupported";

export interface PushEnvironment {
  readonly hasServiceWorker: boolean;
  readonly hasPushManager: boolean;
  readonly userAgent: string;
  readonly standalone: boolean;
}

/** iPhone/iPad Safari gets web push only once the site is on the home screen (iOS 16.4+). */
export function pushSupport(env: PushEnvironment): PushSupport {
  if (env.hasServiceWorker && env.hasPushManager) return "ready";
  const isApple = /iPhone|iPad|iPod/.test(env.userAgent);
  return isApple && !env.standalone ? "iosNeedsHomeScreen" : "unsupported";
}

/** The VAPID public key (URL-safe base64) as the bytes PushManager.subscribe wants. */
export function vapidKeyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64Url}${"=".repeat((4 - (base64Url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
