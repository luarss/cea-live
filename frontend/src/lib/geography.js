const MAP_WEST = 103.595;
const MAP_NORTH = 1.478;
const MAP_SCALE = 1000;

export const MAP_WIDTH = 450;
export const MAP_HEIGHT = 250;

const ISLAND_OUTLINE = [
  [103.61, 1.322], [103.64, 1.348], [103.665, 1.37], [103.68, 1.395], [103.69, 1.42],
  [103.705, 1.44], [103.73, 1.448], [103.755, 1.446], [103.77, 1.457], [103.79, 1.462],
  [103.81, 1.468], [103.83, 1.47], [103.85, 1.455], [103.865, 1.43], [103.88, 1.418],
  [103.905, 1.422], [103.925, 1.405], [103.95, 1.39], [103.975, 1.392], [104.0, 1.395],
  [104.03, 1.375], [104.035, 1.35], [104.01, 1.322], [103.98, 1.31], [103.95, 1.305],
  [103.92, 1.298], [103.895, 1.293], [103.875, 1.284], [103.865, 1.268], [103.845, 1.262],
  [103.825, 1.27], [103.8, 1.275], [103.78, 1.286], [103.755, 1.292], [103.73, 1.298],
  [103.7, 1.305], [103.67, 1.3], [103.645, 1.288], [103.62, 1.29], [103.607, 1.305],
];

const SENTOSA_OUTLINE = [
  [103.81, 1.252], [103.825, 1.256], [103.84, 1.252], [103.845, 1.245], [103.83, 1.241], [103.812, 1.245],
];

const UBIN_OUTLINE = [
  [103.935, 1.412], [103.955, 1.42], [103.98, 1.422], [103.995, 1.414], [103.975, 1.404], [103.95, 1.403],
];

const JURONG_ISLAND_OUTLINE = [
  [103.665, 1.272], [103.685, 1.282], [103.71, 1.284], [103.725, 1.274], [103.71, 1.258], [103.685, 1.256],
];

const TOWN_CENTROIDS = {
  'ANG MO KIO': [103.849, 1.369],
  BEDOK: [103.927, 1.324],
  BISHAN: [103.848, 1.351],
  'BUKIT BATOK': [103.749, 1.359],
  'BUKIT MERAH': [103.82, 1.28],
  'BUKIT PANJANG': [103.772, 1.378],
  'BUKIT TIMAH': [103.79, 1.33],
  'CENTRAL AREA': [103.85, 1.29],
  'CHOA CHU KANG': [103.745, 1.384],
  CLEMENTI: [103.765, 1.315],
  GEYLANG: [103.887, 1.318],
  HOUGANG: [103.892, 1.371],
  'JURONG EAST': [103.742, 1.333],
  'JURONG WEST': [103.705, 1.34],
  'KALLANG/WHAMPOA': [103.862, 1.31],
  'MARINE PARADE': [103.905, 1.302],
  'PASIR RIS': [103.949, 1.373],
  PUNGGOL: [103.906, 1.405],
  QUEENSTOWN: [103.786, 1.294],
  SEMBAWANG: [103.82, 1.449],
  SENGKANG: [103.894, 1.392],
  SERANGOON: [103.873, 1.355],
  TAMPINES: [103.945, 1.354],
  TENGAH: [103.73, 1.364],
  'TOA PAYOH': [103.847, 1.334],
  WOODLANDS: [103.787, 1.436],
  YISHUN: [103.836, 1.429],
};

const DISTRICT_CENTROIDS = {
  1: [103.851, 1.282],
  2: [103.843, 1.275],
  3: [103.817, 1.29],
  4: [103.82, 1.267],
  5: [103.775, 1.3],
  6: [103.85, 1.293],
  7: [103.858, 1.301],
  8: [103.855, 1.311],
  9: [103.832, 1.302],
  10: [103.805, 1.318],
  11: [103.837, 1.322],
  12: [103.85, 1.327],
  13: [103.88, 1.335],
  14: [103.895, 1.318],
  15: [103.905, 1.305],
  16: [103.94, 1.32],
  17: [103.97, 1.36],
  18: [103.946, 1.36],
  19: [103.887, 1.375],
  20: [103.845, 1.36],
  21: [103.775, 1.34],
  22: [103.715, 1.335],
  23: [103.765, 1.37],
  24: [103.71, 1.405],
  25: [103.765, 1.44],
  26: [103.83, 1.39],
  27: [103.83, 1.44],
  28: [103.87, 1.405],
};

const DISTRICT_NUMBER_PATTERN = /^D(\d+)\s/;

function project([longitude, latitude]) {
  return {
    x: (longitude - MAP_WEST) * MAP_SCALE,
    y: (MAP_NORTH - latitude) * MAP_SCALE,
  };
}

function toPath(outline) {
  return outline
    .map(project)
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ') + ' Z';
}

export const ISLAND_PATHS = [ISLAND_OUTLINE, SENTOSA_OUTLINE, UBIN_OUTLINE, JURONG_ISLAND_OUTLINE].map(toPath);

export function locationPoint(location) {
  if (!location) return null;
  const districtMatch = DISTRICT_NUMBER_PATTERN.exec(location);
  const coordinates = districtMatch
    ? DISTRICT_CENTROIDS[Number(districtMatch[1])]
    : TOWN_CENTROIDS[location.toUpperCase()];
  return coordinates ? project(coordinates) : null;
}
