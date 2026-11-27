"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/primitives/Button";
import { pushSupport, vapidKeyBytes, type PushSupport } from "@/lib/push/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const SERVICE_WORKER_URL = "/push-sw.js";

type Phase = "idle" | "working" | "done" | "denied" | "failed";

const MESSAGES: Readonly<Record<Exclude<Phase, "idle" | "working">, string>> = {
  done: "알림을 켰어요. 통관이 끝나면 이 기기로 알려 드릴게요 (최대 14일).",
  denied: "알림이 차단돼 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.",
  failed: "알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요."
};

async function subscribe(trackingNumber: string): Promise<Phase> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY) }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trackingNumber, subscription: subscription.toJSON() })
  });
  return response.ok ? "done" : "failed";
}

const subscribeNever = (): (() => void) => () => undefined;
const readServerSupport = (): PushSupport | null => null;
let cachedSupport: PushSupport | null = null;

/** The browser's push support never changes within a page, so it is read once. */
function readSupport(): PushSupport {
  cachedSupport ??= pushSupport({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    userAgent: navigator.userAgent,
    standalone: window.matchMedia("(display-mode: standalone)").matches
  });
  return cachedSupport;
}

/**
 * '통관 완료되면 알림 받기' (11월 28일 요청) under the clearance estimate. Hidden until push is configured; on an
 * iPhone outside the home-screen app it explains how to turn it on instead.
 */
export function PushAlertButton({ trackingNumber }: { readonly trackingNumber: string }): React.JSX.Element | null {
  const support = useSyncExternalStore<PushSupport | null>(subscribeNever, readSupport, readServerSupport);
  const [phase, setPhase] = useState<Phase>("idle");

  if (VAPID_PUBLIC_KEY === "" || support === null || support === "unsupported") return null;
  if (support === "iosNeedsHomeScreen") {
    return (
      <p data-push-alert="ios" className="m-0 rounded-tt-card bg-tt-ground px-4 py-3 text-tt-sm [word-break:keep-all]">
        아이폰은 Safari 공유 버튼 → <b>홈 화면에 추가</b> 후, 홈 화면에서 이 번호를 다시 조회하면 통관 완료 알림을 받을 수 있어요.
      </p>
    );
  }

  const start = (): void => {
    if (phase === "working") return;
    setPhase("working");
    subscribe(trackingNumber).then(setPhase, () => setPhase("failed"));
  };

  return (
    <div data-push-alert="ready" className="flex flex-col gap-2">
      {phase === "done" ? null : (
        <Button variant="secondary" size="lg" busy={phase === "working"} onClick={start}>
          통관 완료되면 알림 받기
        </Button>
      )}
      {phase === "idle" || phase === "working" ? null : (
        <p role="status" className="m-0 text-tt-sm [word-break:keep-all]">
          {MESSAGES[phase]}
        </p>
      )}
    </div>
  );
}
