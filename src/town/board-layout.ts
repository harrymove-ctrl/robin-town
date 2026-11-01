// Shared geometry for drawing, trading, computer moves, 3D projection, and business income.
export const BOARD_REVISION = 2;
export const CELL_PITCH = 52;
export const CELL_SIZE = 50;

export interface BlockLayout {
  x: number;
  y: number;
  rows: number[][];
}

export interface PlotLayout {
  id: number;
  block: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

export const BLOCK_LAYOUTS: BlockLayout[] = [
  {
    x: 92,
    y: 100,
    rows: [
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
    ],
  },
  {
    x: 399,
    y: 105,
    rows: [
      [0, 1],
      [0, 1, 2],
      [0, 1, 2, 3],
      [1, 2, 3],
    ],
  },
  {
    x: 747,
    y: 120,
    rows: [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2, 3],
      [2, 3],
    ],
  },
  {
    x: 156,
    y: 439,
    rows: [
      [1, 2],
      [1, 2, 3],
      [0, 1, 2],
      [0, 1, 2, 3],
    ],
  },
  {
    x: 464,
    y: 404,
    rows: [
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
      [0, 1, 2],
    ],
  },
  {
    x: 796,
    y: 451,
    rows: [
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1],
      [0, 1, 2],
    ],
  },
];

export const PLOT_LAYOUT: PlotLayout[] = BLOCK_LAYOUTS.flatMap((block, blockIndex) => {
  let index = 0;
  return block.rows.flatMap((columns, row) =>
    columns.map((col) => ({
      id: blockIndex * 12 + index++,
      block: blockIndex,
      col,
      row,
      x: block.x + col * CELL_PITCH,
      y: block.y + row * CELL_PITCH,
    })),
  );
});

const edges: number[][] = PLOT_LAYOUT.map((plot) =>
  PLOT_LAYOUT.filter(
    (candidate) =>
      candidate.block === plot.block &&
      Math.abs(candidate.col - plot.col) + Math.abs(candidate.row - plot.row) === 1,
  ).map((candidate) => candidate.id),
);

export function plotNeighbors(id: number): number[] {
  return edges[id] ? [...edges[id]] : [];
}
