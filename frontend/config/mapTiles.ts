import L from 'leaflet';

export type MapCoordSystem = 'wgs84' | 'gcj02';

export type MapTileProvider = 'osm' | 'tianditu' | 'gaode';

const CHINA_TIMEZONES = new Set([
  'Asia/Shanghai',
  'Asia/Chongqing',
  'Asia/Urumqi',
  'Asia/Harbin',
]);

const OSM_PROBE_URL = 'https://a.tile.openstreetmap.org/3/6/3.png';
const OSM_PROBE_TIMEOUT_MS = 2500;
const TILE_ERROR_THRESHOLD = 4;

function getTiandituKey(): string | undefined {
  const key = import.meta.env.VITE_TIANDITU_TK;
  return typeof key === 'string' && key.trim() ? key.trim() : undefined;
}

/** Heuristic: mainland China users rarely reach OSM tile servers. */
export function likelyInMainlandChina(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (CHINA_TIMEZONES.has(tz)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function probeOsmReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      img.src = '';
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), OSM_PROBE_TIMEOUT_MS);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = `${OSM_PROBE_URL}?_=${Date.now()}`;
  });
}

export async function pickInitialTileProvider(): Promise<MapTileProvider> {
  if (getTiandituKey()) return 'tianditu';
  if (likelyInMainlandChina()) return 'gaode';
  const osmOk = await probeOsmReachable();
  return osmOk ? 'osm' : 'gaode';
}

export function coordSystemForProvider(provider: MapTileProvider): MapCoordSystem {
  return provider === 'gaode' ? 'gcj02' : 'wgs84';
}

function createOsmLayer(): L.TileLayer {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  });
}

function createGaodeLayer(): L.TileLayer {
  return L.tileLayer(
    'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    {
      maxZoom: 18,
      subdomains: ['1', '2', '3', '4'],
    },
  );
}

function createTiandituLayers(key: string): L.LayerGroup {
  const vec = L.tileLayer(
    'https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=' + key,
    { maxZoom: 18, subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'] },
  );
  const label = L.tileLayer(
    'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=' + key,
    { maxZoom: 18, subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'] },
  );
  return L.layerGroup([vec, label]);
}

function createLayerForProvider(provider: MapTileProvider): L.Layer {
  if (provider === 'tianditu') {
    const key = getTiandituKey();
    if (key) return createTiandituLayers(key);
  }
  if (provider === 'gaode') return createGaodeLayer();
  return createOsmLayer();
}

export type TileLayerController = {
  provider: MapTileProvider;
  coordSystem: MapCoordSystem;
  layer: L.Layer;
  dispose: () => void;
};

/**
 * Adds a basemap layer with automatic fallback to a China-accessible provider when OSM tiles fail.
 */
export async function attachBasemapLayer(map: L.Map): Promise<TileLayerController> {
  let provider = await pickInitialTileProvider();
  let activeLayer = createLayerForProvider(provider);
  activeLayer.addTo(map);

  let errorCount = 0;
  let switched = provider !== 'osm';
  let disposed = false;

  const onTileError = () => {
    if (disposed || switched || provider !== 'osm') return;
    errorCount += 1;
    if (errorCount < TILE_ERROR_THRESHOLD) return;

    switched = true;
    provider = 'gaode';
    map.removeLayer(activeLayer);
    activeLayer = createGaodeLayer();
    activeLayer.addTo(map);
    bindTileErrors(activeLayer);
  };

  const bindTileErrors = (layer: L.Layer) => {
    if ('on' in layer && typeof layer.on === 'function') {
      layer.on('tileerror', onTileError);
    }
    if (layer instanceof L.LayerGroup) {
      layer.eachLayer((child) => bindTileErrors(child));
    }
  };

  bindTileErrors(activeLayer);

  return {
    get provider() {
      return provider;
    },
    get coordSystem() {
      return coordSystemForProvider(provider);
    },
    get layer() {
      return activeLayer;
    },
    dispose() {
      disposed = true;
      map.removeLayer(activeLayer);
    },
  };
}
