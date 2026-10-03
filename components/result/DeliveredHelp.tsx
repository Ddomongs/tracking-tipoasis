import type { ActionView, HelpItemView } from "@/lib/tracking/types";
import { CallLink } from "./CallLink";
import { HelpDetails } from "./HelpItems";

/** The config help id (config/site.config.ts help[].id) whose body is the 미수령 안내 of a delivered result. */
export const UNDELIVERED_HELP_ITEM_ID = "undelivered";

/**
 * 미수령 안내 (spec §7 delivered): 문 앞·경비실·택배함 → 기사님 → 24시간 뒤 톡톡, as text. It sits in the main column right
 * after 처리 내역 and is opened by [수령이 안 됐다면 여기를 눌러 주세요] (`openDetails(id)`). Since 10월 2일 it ends with one tel: button —
 * the driver (masked number) or the carrier's customer center — so the customer can call at once.
 */
export function DeliveredHelp({
  item,
  id,
  contact,
  carrierName
}: {
  readonly item: HelpItemView;
  readonly id: string;
  readonly contact?: ActionView;
  /** The delivering carrier, emphasised so the customer knows whose message to look for (10월 2일 요청). */
  readonly carrierName: string | null;
}): React.JSX.Element {
  return (
    <HelpDetails item={item} id={id} deliveredHelp>
      <p data-delivered-sms="true" className="m-0 mt-1 border-0 border-l-4 border-solid border-tt-accent bg-tt-ground px-3 py-2 text-tt-sm [word-break:keep-all]">
        {carrierName === null ? "택배" : <strong className="text-tt-accent">{carrierName}</strong>} 기사님 번호로 온 배송 완료 문자(사진)를 먼저
        확인해 보세요. 놓아 둔 곳이 적혀 있는 경우가 많아요.
      </p>
      {contact === undefined ? null : (
        <div data-delivered-contact="true" className="flex flex-col gap-2 pt-2">
          <p className="m-0 text-tt-sm font-bold [word-break:keep-all]">받지 못하셨다면 여기로 바로 연락해 보세요</p>
          <div>
            <CallLink action={contact} />
          </div>
        </div>
      )}
    </HelpDetails>
  );
}
