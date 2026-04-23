type EventHandler<T> = (data: T) => void;

interface EventSubscription<T> {
  handler: EventHandler<T>;
  once: boolean;
}

export default class EventBus<T> {
  private subscriptions: Map<string, EventSubscription<T>[]> = new Map();
  private static _ins: EventBus<any>

  public static get instance(): EventBus<any> {
    if (!this._ins) this._ins = new EventBus();
    return this._ins
  }

  public on(eventName: string, handler: EventHandler<T>): void {
    this.subscribe(eventName, handler, false);
  }

  public off(eventName: string, handler: EventHandler<T>): void {
    this.unsubscribe(eventName, handler);
  }

  public once(eventName: string, handler: EventHandler<T>): void {
    this.subscribe(eventName, handler, true);
  }

  public dispatch(eventName: string, data?: any): void {
    const subscriptions = this.subscriptions.get(eventName);
    if (subscriptions) {
      subscriptions.forEach(subscription => {
        subscription.handler(data);
        if (subscription.once) {
          this.unsubscribe(eventName, subscription.handler);
        }
      });
    }
  }

  private subscribe(eventName: string, handler: EventHandler<T>, once: boolean): void {
    this.unsubscribe(eventName, handler);
    const subscription: EventSubscription<T> = { handler, once };
    const subscriptions = this.subscriptions.get(eventName) || [];
    subscriptions.push(subscription);
    this.subscriptions.set(eventName, subscriptions);
  }

  private unsubscribe(eventName: string, handler: EventHandler<T>): void {
    const subscriptions = this.subscriptions.get(eventName);
    if (subscriptions) {
      const index = subscriptions.findIndex(subscription => subscription.handler === handler);
      if (index !== -1) {

        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.subscriptions.delete(eventName);
        }
      }
    }
  }
}


export enum EBusEvent {
  Mention_Select = 'Mention_Select',
  Mention_Select_File = 'Mention_Select_File',

  Focus_Textarea = 'Focus_Textarea',  // 输入框聚焦

  Exceed_Session_Length = 'Exceed_Session_Length', // 超出会话长度

  Edit_User_Message = 'Edit_User_Message', // 编辑用户消息

  Docs_File_Upload = 'Docs_File_Upload', // 文件上传

  CodeChat_Unlock_Scroll = 'CodeChat_Unlock_Scroll', // 代码聊天解锁自动滚动

  Submit_Init_Prompt = 'Submit_Init_Prompt', // 提交初始化 prompt（用于 Spec 初始化）

  Update_User_Quota = 'Update_User_Quota', // 更新用户账单
}