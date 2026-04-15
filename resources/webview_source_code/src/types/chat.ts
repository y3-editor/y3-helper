export enum ChatRole {
	System = 'system',
	User = 'user',
	Assistant = 'assistant',
	Tool = 'tool',
}

export interface TokenUsage {
  "completion_tokens": number,
  "prompt_tokens": number,
  "total_tokens": number,
  "prompt_tokens_details": {
    "cached_tokens": number
  },
  "completion_tokens_details": {
    "reasoning_tokens": number,
    "text_tokens": number
  }
}
