import { p as o, S as l } from "./index-8cf7e038.js";
import "./react-vendor-f5e19699.js";
import "./utils-vendor-57f01f77.js";
async function t(r) {
  try {
    const e = await o({ requestUrl: `${l}/api/usage/report`, method: "post", requestData: r }, 1e4, true, void 0, { errorToast: false });
    return console.log("[SkillUsage] Report success:", e), e;
  } catch (e) {
    return console.warn("[SkillUsage] Report failed:", e), null;
  }
}
function i(r, e) {
  return t({ event_type: "install", skill_name: r, event_params: e });
}
function p(r, e) {
  return t({ event_type: "invoke", skill_name: r, event_params: e });
}
export {
  i as reportSkillInstall,
  p as reportSkillInvoke,
  t as reportSkillUsage
};
