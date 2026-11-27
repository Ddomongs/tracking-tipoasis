import type { PushRecord, StoredPushSubscription } from "@/lib/push/store";

export interface PushPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

export interface CheckDeps {
  /** True once customs cleared the number; null when that could not be checked this time. */
  readonly isCleared: (number: string) => Promise<boolean | null>;
  /** True when the push service accepted it. */
  readonly send: (subscription: StoredPushSubscription, payload: PushPayload) => Promise<boolean>;
  readonly remove: (key: string) => Promise<void>;
  /** Stop starting new numbers once this returns true (the function's time budget). */
  readonly outOfTime: () => boolean;
}

export interface CheckSummary {
  readonly checked: number;
  readonly cleared: number;
  readonly sent: number;
  readonly removed: number;
}

/** The last four digits only: a lock-screen notification never shows the whole number. */
export function clearedPayload(number: string): PushPayload {
  return {
    title: "통관이 완료됐어요",
    body: `끝자리 ${number.slice(-4)} 화물이 통관을 마쳤어요. 곧 택배사로 넘어가요.`,
    url: `/${encodeURIComponent(number)}`
  };
}

/**
 * One pass over the subscriptions: each number is looked up once (however many devices wait for it); cleared numbers
 * notify every device and then forget all of their records. Waiting numbers stay until their 14-day expiry.
 */
export async function checkSubscriptions(
  records: ReadonlyArray<{ key: string; record: PushRecord }>,
  deps: CheckDeps
): Promise<CheckSummary> {
  const byNumber = new Map<string, Array<{ key: string; record: PushRecord }>>();
  for (const item of records) byNumber.set(item.record.number, [...(byNumber.get(item.record.number) ?? []), item]);

  let checked = 0;
  let cleared = 0;
  let sent = 0;
  let removed = 0;
  for (const [number, items] of byNumber) {
    if (deps.outOfTime()) break;
    checked += 1;
    if ((await deps.isCleared(number)) !== true) continue;
    cleared += 1;
    for (const { key, record } of items) {
      if (await deps.send(record.subscription, clearedPayload(number))) sent += 1;
      // A failed send is not retried: the subscription is usually gone (404/410), and a stuck record would repeat.
      await deps.remove(key);
      removed += 1;
    }
  }
  return { checked, cleared, sent, removed };
}
