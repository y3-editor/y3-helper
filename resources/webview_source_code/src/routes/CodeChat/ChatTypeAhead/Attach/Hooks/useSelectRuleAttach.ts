import { useCallback } from "react"
import { IMultiAttachment, RuleItem, useChatAttach } from "../../../../../store/chat"
import { AttachType } from "../../../../../store/attaches"
import { Rule } from "../../../../../store/workspace"
import { cloneDeep } from "lodash"
import EventBus, { EBusEvent } from "../../../../../utils/eventbus"

export const useSelectRuleAttach = (): {
  selectRuleAttaches: (rules: Rule[], autoFill?: boolean) => void
  removeRuleAttaches: (rules: Rule[]) => void
} => {
  const attachs = useChatAttach((state) => state.attachs)
  const updateAttach = useChatAttach((state) => state.update)

  const convertToRuleAttach = useCallback((rule: Rule) => {
    return {
      ...rule,
      attachType: AttachType.Rules,
    }
  }, [])

  // 处理选中规则
  const selectRuleAttaches = useCallback((rules: Rule[], autoFill = true) => {
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource: rules.map(rule => convertToRuleAttach(rule))
      })
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment)?.dataSource || []))
      rules.forEach(rule => {
        const targetIndex = dataSource.findIndex(i => i.attachType === AttachType.Rules && (i as RuleItem)?.filePath === rule.filePath)
        if (targetIndex >= 0) {
          // 如果已存在，更新
          dataSource[targetIndex] = convertToRuleAttach(rule)
        } else {
          // 如果不存在，添加
          dataSource.push(convertToRuleAttach(rule))
        }
      })
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource
      })
    }
    
    // 自动填充附件到输入框
    if (autoFill) {
      EventBus.instance.dispatch(EBusEvent.Mention_Select, {
        type: AttachType.Rules,
        data: rules,
      })
    }
  }, [attachs, convertToRuleAttach, updateAttach])

  // 移除规则附件
  const removeRuleAttaches = useCallback((rules: Rule[]) => {
    if (attachs?.attachType !== AttachType.MultiAttachment) {
      updateAttach(undefined)
    } else {
      const dataSource = cloneDeep(((attachs as IMultiAttachment)?.dataSource || []))
      rules.forEach(rule => {
        const targetIndex = dataSource.findIndex(i => i.attachType === AttachType.Rules && (i as RuleItem)?.filePath === rule.filePath)
        if (targetIndex >= 0) {
          dataSource.splice(targetIndex, 1)
        }
      })
      updateAttach({
        attachType: AttachType.MultiAttachment,
        dataSource,
      })
    }
  }, [attachs, updateAttach])

  return {
    selectRuleAttaches,
    removeRuleAttaches,
  }
}