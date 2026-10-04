import { expect, test } from "@playwright/test";
import { parseCarrierTrackingHtml } from "@/lib/services/carrier-html";

/** The shape of ilogen.com's 배송정보 table (10월 4일 확인); rows are made up. */
const LOGEN_HTML = `<table class="data tkInfo"><thead><tr>
<th scope="col">날짜</th><th scope="col">사업장</th><th scope="col">배송상태</th><th scope="col">배송내용</th>
<th scope="col">담당직원</th><th scope="col">인수자</th><th scope="col">영업소</th><th scope="col">연락처</th>
</tr></thead><tbody>
<tr><td>2026.10.01 09:10</td><td>테스트터미널</td><td>집하</td><td> 물품을 집하했습니다. </td><td></td><td></td><td></td><td></td></tr>
<tr><td>2026.10.02 14:20</td><td>테스트영업소</td><td>배송완료
</td><td> 배송을 완료했습니다. </td><td></td><td>본인</td><td></td><td></td></tr>
</tbody></table>`;

test("로젠: every row is read, with the place from 사업장 (not the empty 영업소 column)", () => {
  expect(parseCarrierTrackingHtml("LOGEN", LOGEN_HTML)).toEqual([
    { status: "집하", statusCode: 5, datetime: "2026-10-01T09:10:00+09:00", location: "테스트터미널", detail: "물품을 집하했습니다." },
    { status: "배송완료", statusCode: 7, datetime: "2026-10-02T14:20:00+09:00", location: "테스트영업소", detail: "배송을 완료했습니다." }
  ]);
});

test("a table of another carrier is not read as 로젠", () => {
  expect(parseCarrierTrackingHtml("HANJIN", LOGEN_HTML)).toEqual([]);
});
