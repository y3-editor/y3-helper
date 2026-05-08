<<<<<<<< HEAD:resources/codemaker/webview/assets/skillUsage-9805e631.js
import { p as o, S as l } from "./index-35ab03f2.js";
import "./react-vendor-e7e0feca.js";
import "./utils-vendor-5dedfe48.js";
========
import { p as o, S as l } from "./index-a7126218.js";
import "./react-vendor-b22e83e2.js";
import "./utils-vendor-1b700ae5.js";
>>>>>>>> 62da6ef (sync: 合并上游 2026-03-31 ~ 2026-04-09 更新 (MCP修复 + Subagent基础架构 + ClaudeEdit工具修复)):resources/codemaker/webview/assets/skillUsage-4630af90.js
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
