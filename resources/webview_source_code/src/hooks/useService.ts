import { nanoid } from 'nanoid';
import useSWR, {
  SWRConfiguration,
  mutate as swrMutate,
  SWRResponse,
} from 'swr';
import { MutatorCallback } from 'swr/_internal';
import useIsFocused from './useIsFocused';
import { useEffect, useState } from 'react';

const serviceToKeyMap = new WeakMap<any, string>();
const keyToServiceMap = new Map<string, any>();

/** @internal */
export function getServiceKey(service: any): string {
  const found = serviceToKeyMap.get(service);
  if (found) return found;
  const key = nanoid();
  serviceToKeyMap.set(service, key);
  keyToServiceMap.set(key, service);
  return key;
}

function getServiceByKey(key: string): any {
  const service = keyToServiceMap.get(key);
  if (!service) {
    throw new Error('service not found');
  }
  return service;
}

function fetcher<TArgs extends unknown[], TData>([serviceKey, ...args]: [
  string,
  ...TArgs,
]): TData | Promise<TData> {
  const service: (...args: TArgs) => TData | Promise<TData> =
    getServiceByKey(serviceKey);
  return service(...args);
}

/** @public */
function useService<TData, TError = any>(
  service: () => TData | Promise<TData>,
  config?: SWRConfiguration<TData, TError>,
): SWRResponse<TData, TError>;
/** @public */
function useService<TArgs extends any[], TData, TError = any>(
  service: (...args: TArgs) => TData | Promise<TData>,
  args: TArgs | null,
  config?: SWRConfiguration<TData, TError>,
): SWRResponse<TData, TError>;
/** @public */
function useService<TArgs extends any[], TData = any, TError = any>(
  service: (...args: TArgs) => TData | Promise<TData>,
  ...rest: any[]
): SWRResponse<TData, TError> {
  let config: SWRConfiguration<TData, TError> | undefined;
  let args: any[] | null = [];
  if (Array.isArray(rest[0]) || rest[0] === null) {
    args = rest[0];
    config = rest[1];
  } else if (typeof rest[0] === 'object' && rest[0] !== null) {
    config = rest[0];
  } else if (typeof rest[1] === 'object') {
    config = rest[1];
  }

  const isFocused = useIsFocused();
  const [isHadFocused, setIsHadFocused] = useState(isFocused);

  useEffect(() => {
    if (isFocused) {
      setIsHadFocused(true);
    }
  }, [isFocused]);

  const result = useSWR<TData, TError>(
    isHadFocused ? args && [getServiceKey(service), ...args] : null,
    fetcher,
    config,
  );

  return result;
}

/** @public */
export function mutateService<TData>(
  service: () => TData | Promise<TData>,
  options?: {
    data?: TData | Promise<TData> | MutatorCallback<TData>;
    shouldRevalidate?: boolean;
  },
): Promise<TData | undefined>;
/** @public */
export function mutateService<TArgs extends any[], TData>(
  service: (...args: TArgs) => TData | Promise<TData>,
  args: TArgs,
  options: {
    data?: TData | Promise<TData> | MutatorCallback<TData>;
    shouldRevalidate?: boolean;
  },
): Promise<TData | undefined>;
/** @public */
export function mutateService<TArgs extends any[], TData>(
  service: (...args: TArgs) => TData | Promise<TData>,
  ...rest: any[]
): Promise<TData | undefined> {
  let args: any[] = [];
  let options: {
    data?: TData | Promise<TData> | MutatorCallback<TData>;
    shouldRevalidate?: boolean;
  } = {};

  if (Array.isArray(rest[0])) {
    args = rest[0];
    if (rest[1]) {
      options = rest[1];
    }
  } else if (typeof rest[0] === 'object') {
    options = rest[0];
  }

  return swrMutate(
    [getServiceKey(service), ...args],
    options.data,
    options.shouldRevalidate,
  );
}

export default useService;
