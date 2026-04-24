import { p as o, S as l, __tla as __tla_0 } from "./index-88856577.js";
import "./react-vendor-0d5b885c.js";
import "./utils-vendor-efe9c261.js";
let i, p, t;
let __tla = Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })()
]).then(async () => {
  t = async function(r) {
    try {
      const e = await o({
        requestUrl: `${l}/api/usage/report`,
        method: "post",
        requestData: r
      }, 1e4, true, void 0, {
        errorToast: false
      });
      return console.log("[SkillUsage] Report success:", e), e;
    } catch (e) {
      return console.warn("[SkillUsage] Report failed:", e), null;
    }
  };
  i = function(r, e) {
    return t({
      event_type: "install",
      skill_name: r,
      event_params: e
    });
  };
  p = function(r, e) {
    return t({
      event_type: "invoke",
      skill_name: r,
      event_params: e
    });
  };
});
export {
  __tla,
  i as reportSkillInstall,
  p as reportSkillInvoke,
  t as reportSkillUsage
};
