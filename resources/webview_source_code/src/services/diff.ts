export async function getLocalDiffData(): Promise<{
  repoDiff: string;
  repoStatus: string;
  noRepo: boolean;
  repoType?: string;
}> {
  window.parent.postMessage(
    {
      type: 'GET_REPO_LOCAL_DIFF',
    },
    '*',
  );
  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const
    let timer: number | undefined;
    function handlePostMessage(event: MessageEvent) {
      const message = event.data as any;
      // 当收到特定类型的消息时，解决这个promise并移除这个事件监听器
      switch (message.type) {
        case 'REPO_LOCAL_DIFF':
          resolve(message.data);
          clearTimeout(timer);
          window.removeEventListener('message', handlePostMessage);
          break;
      }
    }

    // 添加事件监听器
    window.addEventListener('message', handlePostMessage);

    // 设置超时，如果在一定时间内没有收到消息，就拒绝这个promise
    timer = window.setTimeout(() => {
      resolve({
        repoDiff: '',
        repoStatus: '',
        noRepo: true,
      });
      window.removeEventListener('message', handlePostMessage);
    }, 3000);
  });
}
