/**
 * Pre-paint style script (spec §13 "깜빡임 방지"). A tiny inline <head> script that sets html[data-style] before the
 * first paint: the stored choice (localStorage tt:style, read in try/catch); else "night" when the device is in dark mode
 * and html[data-follow-dark="1"] (config style.followSystemDark); else "signal". '/' stays static — the server always
 * renders data-style="signal" and this script changes the attribute in the browser before anything is painted.
 *
 * The text is a constant because its SHA-256 goes into the CSP (lib/security/headers.ts through next.config.ts), so an
 * enforced script-src can allow it by hash without 'unsafe-inline'. No imports: next.config.ts loads this file by a
 * relative path. The ids and the key must match lib/style/styles.ts; tests/unit/prepaint.spec.ts checks them and the hash.
 */
export const PREPAINT_SCRIPT_ID = "tt-prepaint";

export const PREPAINT_SCRIPT =
  '(function(){var d=document.documentElement,s=null;' +
  'try{s=window.localStorage.getItem("tt:style")}catch(e){}' +
  'if(s!=="signal"&&s!=="manifest"&&s!=="night"){s="signal";' +
  'try{if(d.getAttribute("data-follow-dark")==="1"&&window.matchMedia("(prefers-color-scheme: dark)").matches){s="night"}}catch(e){}}' +
  'd.setAttribute("data-style",s)})();';

/** base64 SHA-256 of PREPAINT_SCRIPT (UTF-8). Recompute it whenever the text changes: the unit test prints the new value. */
export const PREPAINT_SCRIPT_SHA256 = "TdNQr4k3zLaTHH5Tbi0dMNlxgX+Y+iNDKf16t15FhKE=";

/** The source expression for a CSP script-src. */
export const PREPAINT_CSP_SOURCE = `'sha256-${PREPAINT_SCRIPT_SHA256}'`;
