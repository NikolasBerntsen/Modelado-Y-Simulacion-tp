
export const recommendG = (formula: string): string[] => {
  return [
    `x + (${formula})`,
    `x - (${formula})`,
    `x - (${formula}) / 2`,
  ];
};
