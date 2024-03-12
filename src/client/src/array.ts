export function pushIfNotExists<T extends { id: string }>(array: T[], item: T) {
  if (array.find((x) => x.id === item.id)) return item;
  array.push(item);
  return item;
}
