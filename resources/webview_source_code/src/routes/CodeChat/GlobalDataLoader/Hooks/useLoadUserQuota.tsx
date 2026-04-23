import {
  Box,
  Button,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef } from "react"
import { codemakerApiRequest } from "../../../../services";
import { useChatBillStore } from "../../../../store/chatBill";
import EventBus, { EBusEvent } from "../../../../utils/eventbus";
import { usePostMessage } from "../../../../PostMessageProvider";
import { getLocalStorage, setLocalStorage } from "../../../../utils/storage";
import useCustomToast from "../../../../hooks/useCustomToast";

const REFRESH_INTERVAL = 1 * 60 * 1000 + 20; // vega数据获取回来有延迟

// 定义配额通知相关的存储键和阈值
const QUOTA_NOTIFICATION_KEY = 'codebasechat_quota_notification_record';
const QUOTA_THRESHOLD_80 = 0.8;
const QUOTA_THRESHOLD_90 = 0.9;

interface IQuotaNotificationRecord {
  month: string; // YYYY-MM 格式
  monthly_quota: number;
  notified_80: boolean; // 是否已通知80%阈值
  notified_90: boolean; // 是否已通知90%阈值
}

export interface IUserQuotaUsage {
  user: string;
  quota_config: {
    is_active: boolean;
    monthly_quota: number;
  }
  current_month: {
    month: number
    usage_cost: number
    year: number
  }
  last_month: {
    month: number
    usage_cost: number
    year: number
  }
  prev_month: {
    month: number
    usage_cost: number
    year: number
  }
}

export async function getUserQuotaUsage() {
  const { data } = await codemakerApiRequest('/user_quota/usage', {
    params: {
      quota_type: 'global'
    }
  });
  return data;
}


export const useLoadUserQuota = function () {
  const quotaLoadingRef = useRef(false)
  const setBillLoading = useChatBillStore(state => state.setBillLoading)
  const setMonthlyBills = useChatBillStore(state => state.setMonthlyBills)
  const setCurrentMonthCost = useChatBillStore(state => state.setCurrentMonthCost)
  const setMaxCostPerMonth = useChatBillStore(state => state.setMaxCostPerMonth)
  const setIsExceedCost = useChatBillStore(state => state.setIsExceedCost)
  const { toast } = useCustomToast();

  const { postMessage } = usePostMessage();

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const getMonthStr = useCallback((month: number) => {
    return month < 10 ? `0${month}` : `${month}`
  }, [])

  // 检查并发送配额通知的函数
  const checkAndNotifyQuotaUsage = useCallback((usageData: IUserQuotaUsage) => {
    const currentMonthKey = `${usageData.current_month.year}-${getMonthStr(usageData.current_month.month)}`;
    const { usage_cost = 0 } = usageData.current_month;
    const { monthly_quota = 0 } = usageData.quota_config;

    // 获取当前存储的通知记录
    const record = getLocalStorage<IQuotaNotificationRecord>(QUOTA_NOTIFICATION_KEY);

    // 计算使用率
    const usageRatio = usage_cost / monthly_quota

    // 判断是否需要重置通知状态（过月或配额变化）
    const shouldResetNotification = !record ||
      record.month !== currentMonthKey ||
      record.monthly_quota !== monthly_quota;

    const newRecord = {
      month: currentMonthKey,
      monthly_quota,
      notified_80: shouldResetNotification ? false : (record?.notified_80 || false),
      notified_90: shouldResetNotification ? false : (record?.notified_90 || false),
    };

    const showToast = () => {
      toast({
        title: <Box style={{ zoom: .95 }}>
          您的仓库智聊本月 {monthly_quota * 100} 积分（等值于 {monthly_quota} 元 Token）额度已使用 {(usageRatio * 100).toFixed(1)}%。
          因 3.0 版本上线后需求激增，系统已暂时限制使用权限以兼顾稳定性和成本控制。恢复使用请查阅
          <Button
            variant="link"
            color="#776fff"
            onClick={(e) => {
              e.stopPropagation()
              postMessage({
                type: "OPEN_IN_BROWSER",
                data: { url: `https://g.126.fm/01mMuMV` },
              });
            }}>《积分申请》</Button>
        </Box>,
        status: 'warning',
        duration: 3000,
      })
    }



    // 检查90%阈值（优先级更高）
    if (usageRatio >= QUOTA_THRESHOLD_90 && !newRecord.notified_90) {
      showToast()
      newRecord.notified_90 = true;
      newRecord.notified_80 = true; // 90%时也标记80%为已通知，避免重复提醒
    }
    // 检查80%阈值
    else if (usageRatio >= QUOTA_THRESHOLD_80 && !newRecord.notified_80) {
      showToast()
      newRecord.notified_80 = true;
    }

    // 保存更新后的记录
    setLocalStorage(QUOTA_NOTIFICATION_KEY, newRecord);
  }, [getMonthStr, postMessage, toast])

  const loadQuota = useCallback(() => {
    if (quotaLoadingRef.current) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    quotaLoadingRef.current = true
    setBillLoading(true)
    getUserQuotaUsage()
      .then(res => {
        setMonthlyBills([
          { time: `${res.current_month.year}-${getMonthStr(res.current_month.month)}`, usageCost: res.current_month.usage_cost },
          { time: `${res.last_month.year}-${getMonthStr(res.last_month.month)}`, usageCost: res.last_month.usage_cost },
          { time: `${res.prev_month.year}-${getMonthStr(res.prev_month.month)}`, usageCost: res.prev_month.usage_cost },
        ])
        setCurrentMonthCost(res.current_month.usage_cost)
        setMaxCostPerMonth(res.quota_config.monthly_quota)
        if (res.current_month.usage_cost >= res.quota_config.monthly_quota) {
          setIsExceedCost(true)
        } else {
          setIsExceedCost(false)
        }
        // 检查配额使用率并发送通知
        checkAndNotifyQuotaUsage(res);
      })
      .finally(() => {
        setBillLoading(false)
        quotaLoadingRef.current = false
        timerRef.current = setTimeout(() => {
          loadQuota()
        }, REFRESH_INTERVAL)
      })
  }, [setBillLoading, setMonthlyBills, getMonthStr, setCurrentMonthCost, setMaxCostPerMonth, setIsExceedCost, checkAndNotifyQuotaUsage])

  useEffect(() => {
    // 初次加载
    loadQuota()
    EventBus.instance.on(EBusEvent.Update_User_Quota, loadQuota)
    return () => {
      EventBus.instance.off(EBusEvent.Update_User_Quota, loadQuota)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [loadQuota])
}