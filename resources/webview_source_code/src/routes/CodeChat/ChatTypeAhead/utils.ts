export function scrollToFocusItem(
  wrapElement: HTMLElement,
  index: number,
  behavior: ScrollBehavior = 'auto',
) {
  const item = wrapElement?.querySelector(
    `[data-index="${index}"]`,
  ) as HTMLElement;
  if (!item) {
    return;
  }
  item.scrollIntoView({ behavior });
}

export function getListIndex(data: Array<unknown>, focusIndex: number) {
  if (!data.length) {
    return 0;
  }
  const indexRemainder = focusIndex % data.length;
  return indexRemainder < 0 ? indexRemainder + data.length : indexRemainder;
}
