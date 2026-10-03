import type { ActionView, HelpItemView } from "@/lib/tracking/types";
import { CallLink } from "./CallLink";
import { HelpDetails } from "./HelpItems";

/** The config help id (config/site.config.ts help[].id) whose body is the 미수령 안내 of a delivered result. */
export const UNDELIVERED_HELP_ITEM_ID = "undelivered";

/**
 * 미수령 안내 (spec §7 delivered): 문 앞·경비실·택배함 → 기사님 → 24시간 뒤 톡톡, as text. It sits in the main column right
 * after 처리 내역 and is opened by [받지 못하셨나요?] (`openDetails(id)`). Since 10월 2일 it ends with one tel: button —
 * the driver (masked number) or the carrier's customer center — so the customer can call at once.
 */
export function DeliveredHelp({
  item,
  id,
  contact
}: {
  readonly item: HelpItemView;
  readonly id: string;
  readonly contact?: ActionView;
}): React.JSX.Element {
  return (
    <HelpDetails item={item} id={id} deliveredHelp>
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
