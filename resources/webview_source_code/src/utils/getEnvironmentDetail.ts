export default function getEnvironmentDetails(options: {
  visibleFilesPath?: string[]
}) {

  const { visibleFilesPath = [] } = options
  let details = ""

  if (visibleFilesPath.length) {
    details += "\n\n## VSCode Visible Files";
    details += visibleFilesPath.join("\n");
  }

  // 当前时间信息
  const now = new Date()
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  })
  const timeZone = formatter.resolvedOptions().timeZone
  const timeZoneOffset = -now.getTimezoneOffset() / 60
  const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : ""}${timeZoneOffset}:00`
  details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`


  // TODO：监听文件修改信息，通知模型某些文件上次修改完之后内容有变化了（需要插件侧持续监听维护）
  // const recentlyModifiedFiles = this.fileContextTracker.getAndClearRecentlyModifiedFiles()
  // if (recentlyModifiedFiles.length > 0) {
  //   details +=
  //     "\n\n# Recently Modified Files\nThese files have been modified since you last accessed them (file was just edited so you may need to re-read it before editing):"
  //   for (const filePath of recentlyModifiedFiles) {
  //     details += `\n${filePath}`
  //   }
  // }

  // TODO: 是否展示整体的文件目录内容（应该只在最初 system prompt 
  // if (includeFileDetails) {
  //   details += `\n\n# Current Working Directory (${this.cwd.toPosix()}) Files\n`
  //   const isDesktop = arePathsEqual(this.cwd, getDesktopDir())
  //   if (isDesktop) {
  //     // don't want to immediately access desktop since it would show permission popup
  //     details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
  //   } else {
  //     const [files, didHitLimit] = await listFiles(this.cwd, true, 200)
  //     const result = formatResponse.formatFilesList(this.cwd, files, didHitLimit, this.clineIgnoreController)
  //     details += result
  //   }
  // }

  // TODO: 持续监听运行中的 terminal 动态

  // TODO: problem 异常信息

  // TODO: Plan mode 状态信息


  return `<environment_details>\n${details.trim()}\n</environment_details>`
}