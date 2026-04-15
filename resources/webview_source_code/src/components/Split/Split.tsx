import React, { useRef, useState, useMemo, useEffect, useContext } from 'react';
import styles from './Split.module.css';
import useResizeObserver from '../../hooks/useResizeObserver';
import clsx from 'clsx';
import { ThemeProviderContext } from '../../ThemeContext';

export interface ISplitChildParams {
  absoluteSize: number;
  isMin: boolean;
  collapse: () => void;
  setSize: (value: number) => void;
}
export type SplitChild =
  | React.ReactNode
  | ((params: ISplitChildParams) => React.ReactNode);

// eslint-disable-next-line react-refresh/only-export-components
export enum SplitValueType {
  Percentage = 'percentage',
  Absolute = 'absolute',
  Auto = 'auto',
}

// eslint-disable-next-line react-refresh/only-export-components
export enum SplitDirection {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}

type Sizes =
  | [
    { type: SplitValueType.Auto },
    {
      type: SplitValueType.Absolute | SplitValueType.Percentage;
      value: number;
      min?: number | string;
      max?: number | string;
    },
  ]
  | [
    {
      type: SplitValueType.Absolute | SplitValueType.Percentage;
      value: number;
      min?: number | string;
      max?: number | string;
    },
    { type: SplitValueType.Auto },
  ];

export interface SplitProps {
  /** 用于在 local storage 中记录 sizes */
  id: string;
  direction?: SplitDirection;
  defaultSizes: Sizes;
  children: [SplitChild, SplitChild];
}

const DEFAULT_MIN_SIZE = 26;
const GUTTER_SIZE = 2;

function Split(props: SplitProps) {
  const { id, defaultSizes, children } = props;
  const direction = props.direction || SplitDirection.Horizontal;

  const { activeTheme } = useContext(ThemeProviderContext)

  const [sizes, setSizes] = useState<Sizes>(() => {
    let sizesInLocalStorage: unknown;
    const serializedSizesInLocalStorage = localStorage.getItem(
      getSizesLocalStorageKey(id),
    );
    if (serializedSizesInLocalStorage) {
      try {
        sizesInLocalStorage = JSON.parse(serializedSizesInLocalStorage);
      } catch (e) {
        console.error(e);
      }
    }
    function isValid(maybeSizes: unknown): maybeSizes is Sizes {
      return (
        Array.isArray(maybeSizes) &&
        maybeSizes.length === defaultSizes.length &&
        maybeSizes.every(
          (size) =>
            typeof size === 'object' &&
            (((size.type === SplitValueType.Absolute ||
              size.type === SplitValueType.Percentage) &&
              typeof size.value === 'number') ||
              size.type === SplitValueType.Auto),
        ) &&
        (((maybeSizes[0].type === SplitValueType.Absolute ||
          maybeSizes[0].type === SplitValueType.Percentage) &&
          maybeSizes[1].type === SplitValueType.Auto) ||
          (maybeSizes[0].type === SplitValueType.Auto &&
            (maybeSizes[1].type === SplitValueType.Absolute ||
              maybeSizes[1].type === SplitValueType.Percentage)))
      );
    }
    return isValid(sizesInLocalStorage) ? sizesInLocalStorage : defaultSizes;
  });
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;

  const [containerRef, containerRect] = useResizeObserver();
  const containerRectRef = useRef(containerRect);
  containerRectRef.current = containerRect;

  const handleGutterMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isVertical = direction === SplitDirection.Vertical;
    let lastPosition = isVertical ? e.clientY : e.clientX;
    const containerSize = containerRect[isVertical ? 'height' : 'width'];

    function handleMouseMove(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
      const currentPosition = isVertical ? e.clientY : e.clientX;
      const diff = currentPosition - lastPosition;

      setSizes((prev) => {
        function getNextValue(
          size: {
            type: SplitValueType.Absolute | SplitValueType.Percentage;
            value: number;
            min?: number | string;
            max?: number | string;
          },
          isFirst: boolean,
        ): number {
          if (containerSize < DEFAULT_MIN_SIZE) {
            return size.value;
          }

          const sign = isFirst ? 1 : -1;
          let nextAbsoluteValue =
            size.type === SplitValueType.Absolute
              ? size.value + sign * diff
              : containerSize * (size.value / 100) + sign * diff;

          const minSize =
            convert(String(size.min), containerSize) || DEFAULT_MIN_SIZE;
          const maxSize =
            convert(String(size.max), containerSize) ||
            containerSize - DEFAULT_MIN_SIZE;

          nextAbsoluteValue = Math.min(
            Math.max(nextAbsoluteValue, minSize),
            maxSize,
          );

          return size.type === SplitValueType.Absolute
            ? nextAbsoluteValue
            : (nextAbsoluteValue / containerSize) * 100;
        }
        return prev[0].type !== SplitValueType.Auto
          ? [
            {
              ...prev[0],
              value: getNextValue(prev[0], true),
            },
            { type: SplitValueType.Auto },
          ]
          : prev[1].type !== SplitValueType.Auto
            ? [
              { type: SplitValueType.Auto },
              {
                ...prev[1],
                value: getNextValue(prev[1], false),
              },
            ]
            : prev;
      });
      lastPosition = currentPosition;
    }
    function handleMouseUp() {
      document.body.style.cursor = 'default';
      clear();
    }
    function clear() {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return clear;
  };

  useEffect(() => {
    localStorage.setItem(getSizesLocalStorageKey(id), JSON.stringify(sizes));
  }, [id, sizes]);

  const absoluteSizes: [number, number] = useMemo(() => {
    const dimension =
      direction === SplitDirection.Vertical ? 'height' : 'width';
    function getAbsoluteSize(size: {
      type: SplitValueType.Absolute | SplitValueType.Percentage;
      value: number;
    }): number {
      if (size.type === SplitValueType.Percentage) {
        return (containerRect[dimension] * size.value) / 100;
      }
      return size.value;
    }
    if (sizes[0].type !== SplitValueType.Auto) {
      const size = getAbsoluteSize(sizes[0]);
      return [
        size - GUTTER_SIZE / 2,
        containerRect[dimension] - size - GUTTER_SIZE / 2,
      ];
    } else if (sizes[1].type !== SplitValueType.Auto) {
      const size = getAbsoluteSize(sizes[1]);
      return [
        containerRect[dimension] - size - GUTTER_SIZE / 2,
        size - GUTTER_SIZE / 2,
      ];
    }
    throw new Error();
  }, [containerRect, direction, sizes]);

  const childrenElements = children.map((child, index) => {
    const size = sizes[index];
    const dimension =
      direction === SplitDirection.Vertical ? 'height' : 'width';
    const style: React.CSSProperties =
      size.type === SplitValueType.Auto
        ? { flex: '1 1 auto' }
        : size.type === SplitValueType.Absolute
          ? { flex: '0 0 auto', [dimension]: size.value }
          : { flex: '0 0 auto', [dimension]: `${size.value}%` };
    const params: ISplitChildParams = {
      absoluteSize: absoluteSizes[index],
      isMin: absoluteSizes[index] <= DEFAULT_MIN_SIZE,
      collapse: () => {
        setSizes((prev) => {
          const size = prev[index];
          if (size.type === SplitValueType.Auto) {
            return prev;
          }
          const next = [prev[0], prev[1]] as typeof prev;
          next[index] = {
            ...size,
            value:
              size.type === SplitValueType.Absolute
                ? DEFAULT_MIN_SIZE
                : (DEFAULT_MIN_SIZE / containerRect[dimension]) * 100,
          };
          return next;
        });
      },
      setSize: (value: number) => {
        setSizes((prev) => {
          const next = [prev[0], prev[1]] as typeof prev;
          const size = next[index];
          if (size.type !== SplitValueType.Auto) {
            size.value = value;
          }
          return next;
        });
      },
    };

    return (
      <div
        key={index}
        style={{ ...style, overflow: index === 0 ? 'hidden' : undefined }}
      >
        {typeof child === 'function' ? child(params) : child}
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{
        flexDirection: direction === SplitDirection.Vertical ? 'column' : 'row',
      }}
    >
      {childrenElements[0]}
      <div
        className={clsx(styles.gutter, {
          [styles.gutterHorizontal]: direction === SplitDirection.Horizontal,
          [styles.gutterVertical]: direction === SplitDirection.Vertical,
        }, `${activeTheme === 'light' && '!bg-black'} `)}
        onMouseDown={handleGutterMouseDown}
      />
      {childrenElements[1]}
    </div>
  );
}

const getSizesLocalStorageKey = (id: string) => `split-wrapper#${id}`;

function convert(str: string, size: number) {
  const tokens = str.match(/([0-9]+)([px|%]*)/);
  if (tokens) {
    const value = tokens[1];
    const unit = tokens[2];
    return toPx(value, size, unit);
  }
  return 0;
}

function toPx(value: string, size: number, unit?: string) {
  switch (unit) {
    case '%': {
      return +((size * Number(value)) / 100).toFixed(2);
    }
    default: {
      return +value;
    }
  }
}

export default Split;
