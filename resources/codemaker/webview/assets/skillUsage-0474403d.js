import { p as o, S as l } from "./index-02a2263e.js";
import "./react-vendor-c3bd7f19.js";
import "./utils-vendor-1496df8d.js";
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
