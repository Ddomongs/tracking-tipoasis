import type { HelpItemView } from "@/lib/tracking/types";
import { HelpDetails } from "./HelpItems";

/** The config help id (config/site.config.ts help[].id) whose body is the 미수령 안내 of a delivered result. */
export const UNDELIVERED_HELP_ITEM_ID = "undelivered";

/**
 * 미수령 안내 (spec §7 delivered): 문 앞·경비실·택배함 → 기사님 → 24시간 뒤 톡톡, as text. It sits in the main column right
 * after 처리 내역 and is opened by [받지 못하셨나요?] (`openDetails(id)`).
 */
export function DeliveredHelp({ item, id }: { readonly item: HelpItemView; readonly id: string }): React.JSX.Element {
  return <HelpDetails item={item} id={id} deliveredHelp />;
}
