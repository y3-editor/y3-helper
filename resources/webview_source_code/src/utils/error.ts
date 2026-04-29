export const httpErrorType: Record<string | number, string> = {
  413: '当前提问的上下文过大，请缩小范围后再提问',
  500: '服务有异常，请联系Codemaker值班',
  403: '请重新登陆后再访问CodemaKer',
  404: '暂时找不到服务，请联系Codemaker值班',
  unknown: '检测到服务有波动,请稍后重试或联系Codemaker值班',
}