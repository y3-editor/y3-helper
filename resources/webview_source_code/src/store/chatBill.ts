import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';


export interface IChatBillStore {
  billLoading: boolean;
  setBillLoading: (loading: boolean) => void;
  isExceedCost: boolean;
  setIsExceedCost: (isExceed: boolean) => void;
  currentMonthCost: number;
  setCurrentMonthCost: (cost: number) => void;
  maxCostPerMonth: number;
  setMaxCostPerMonth: (cost: number) => void;
  monthlyBills: { time: string, usageCost: number }[],
  setMonthlyBills: (monthlyBills: { time: string, usageCost: number }[]) => void;
}

export const useChatBillStore = create<IChatBillStore>()(
  persist(
    (set) => ({
      billLoading: false,
      setBillLoading(loading: boolean) {
        set(() => ({
          billLoading: loading
        }))
      },
      currentMonthCost: 0,
      setCurrentMonthCost(cost: number) {
        set(() => ({
          currentMonthCost: cost
        }))
      },
      maxCostPerMonth: 0,
      setMaxCostPerMonth(cost: number) {
        set(() => ({
          maxCostPerMonth: cost
        }))
      },
      isExceedCost: false,
      setIsExceedCost(isExceed: boolean) {
        set(() => ({
          isExceedCost: isExceed
        }))
      },
      monthlyBills: [],
      setMonthlyBills(bills: { time: string, usageCost: number }[]) {
        set(() => ({
          monthlyBills: bills
        }))
      },
    }),
    {
      name: 'codemaker-chat-bill-store',
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({
      }),
    },
  )
);