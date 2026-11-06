import React, { useEffect, useRef, useState } from 'react';
import {
  KALTIM_REGIONS,
  KaltimCityKey,
  ServiceType,
  calculateWarrantyStatus,
} from '@/services/cctvCommandService';
import { cn } from '@/lib/utils';
import { Layers, Navigation, Satellite, Map as MapIcon, Moon, ShieldCheck } from 'lucide-react';

export interface MapMarkerItem {
  id: string;
  title: string;
  subtitle: string;
  city: string;
  service_type: ServiceType;
  package_name: string;
  lat: number;
  lng: number;
  progress: number;
  installed_at?: string | null;
  warranty_months?: number;
  rating?: number;
  review_text?: string;
  hardware_specs?: string;
  photos?: string[];
  isPublicMode?: boolean;
}

interface CCTVLeafletMapProps {
  items: MapMarkerItem[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  activeCity?: KaltimCityKey;
  onCityQuickJump?: (city: KaltimCityKey) => void;
  isPublicPortfolio?: boolean;
  heightClass?: string;
  rightPanel?: React.ReactNode;
  headerRightSlot?: React.ReactNode;
}

type MapTileMode = 'satellite' | 'roadmap' | 'dark';

declare global {
  interface Window {
    L?: any;
  }
}

const TILE_CONFIGS: Record<
  MapTileMode,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  satellite: {
    label: 'Satelit HD',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Satellite HD • Borneo Etam GIS',
    maxZoom: 20,
  },
  roadmap: {
    label: 'Jalanan',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Roadmap • Borneo Etam GIS',
    maxZoom: 20,
  },
  dark: {
    label: 'Dark GIS',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Terrain GIS • Borneo Etam',
    maxZoom: 20,
  },
};

function loadLeafletAssets(): Promise<any> {
  if (typeof window !== 'undefined' && window.L) {
    return Promise.resolve(window.L);
  }

  return new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById('leaflet-js-cdn') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js-cdn';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

export const CCTVLeafletMap: React.FC<CCTVLeafletMapProps> = ({
  items,
  selectedId,
  onSelectMarker,
  activeCity = 'ALL',
  onCityQuickJump,
  isPublicPortfolio = false,
  heightClass = 'h-[520px] sm:h-[560px]',
  rightPanel,
  headerRightSlot,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState<boolean>(
    Boolean(typeof window !== 'undefined' && window.L)
  );
  const [tileMode, setTileMode] = useState<MapTileMode>('roadmap');

  useEffect(() => {
    let mounted = true;
    loadLeafletAssets()
      .then(() => {
        if (mounted) setLeafletReady(true);
      })
      .catch((err) => console.error('Failed loading Leaflet:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const initialRegion = KALTIM_REGIONS.find((r) => r.key === activeCity) || KALTIM_REGIONS[0];
    const map = L.map(mapContainerRef.current, {
      center: [initialRegion.lat, initialRegion.lng],
      zoom: initialRegion.zoom,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const cfg = TILE_CONFIGS[tileMode];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletReady]);

  // Recalculate size when rightPanel toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [ Boolean(rightPanel) ]);

  // Switch Basemap Tile Mode
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const cfg = TILE_CONFIGS[tileMode];
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(mapInstanceRef.current);
  }, [tileMode]);

  // Render Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) return;
    const L = window.L;
    const layerGroup = markersLayerRef.current;
    layerGroup.clearLayers();

    items.forEach((item) => {
      if (isNaN(item.lat) || isNaN(item.lng)) return;

      const isDone = item.progress === 100;
      const isWorking = item.progress > 0 && item.progress < 100;
      const isSelected = item.id === selectedId;

      const mainColor = isDone ? '#10b981' : isWorking ? '#f59e0b' : '#f43f5e';
      const ringColor = isDone
        ? 'rgba(16, 185, 129, 0.35)'
        : isWorking
          ? 'rgba(245, 158, 11, 0.35)'
          : 'rgba(244, 63, 94, 0.35)';

      const serviceEmoji =
        item.service_type === 'POS' ? '🖥️' : item.service_type === 'BUNDLING' ? '🏪' : '📹';

      const size = isSelected ? 40 : 32;

      const htmlPin = `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 9999px;
            background: ${ringColor};
            border: 2px solid ${mainColor};
            opacity: ${isSelected ? '0.95' : '0.6'};
          "></div>
          <div style="
            position: relative;
            width: ${size - 6}px;
            height: ${size - 6}px;
            border-radius: 9999px;
            background: ${mainColor};
            border: 2px solid #ffffff;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? '14px' : '12px'};
          ">
            ${serviceEmoji}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'borneo-etam-custom-pin',
        html: htmlPin,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });

      const warranty = calculateWarrantyStatus(
        item.installed_at,
        item.warranty_months || 12,
        item.progress
      );

      const statusText = isDone
        ? '🟢 100% Aktif & Beroperasi'
        : isWorking
          ? `🟡 Pengerjaan (${item.progress}%)`
          : '🔴 0% Antrean Survei';

      const coverPhoto =
        Array.isArray(item.photos) && item.photos.length > 0 ? item.photos[0] : null;
      const photoCount = Array.isArray(item.photos) ? item.photos.length : 0;

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 210px; max-width: 245px; padding: 1px;">
          ${
            coverPhoto
              ? `<div style="position:relative; width:100%; height:96px; border-radius:8px; overflow:hidden; margin-bottom:6px; background:#0f172a;">
                  <img src="${coverPhoto}" alt="Foto Instalasi" style="width:100%; height:100%; object-fit:cover; display:block;" />
                  <span style="position:absolute; bottom:5px; right:5px; font-size:9px; font-weight:800; padding:2px 6px; border-radius:99px; background:rgba(15,23,42,0.82); color:#fff;">
                    📸 ${photoCount} Foto
                  </span>
                </div>`
              : ''
          }
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
            <span style="font-size:9.5px; font-weight:800; text-transform:uppercase; padding:1.5px 6px; border-radius:99px; background:#0d9488; color:#fff;">
              ${item.service_type} • ${item.city}
            </span>
            ${
              item.rating
                ? `<span style="font-size:10.5px; font-weight:700; color:#f59e0b;">★ ${item.rating.toFixed(1)}</span>`
                : ''
            }
          </div>
          <div style="font-weight:800; font-size:12.5px; color:#0f172a; line-height:1.25; margin-bottom:2px;">
            ${item.title}
          </div>
          <div style="font-size:10.5px; color:#475569; margin-bottom:4px;">
            📍 ${item.subtitle}
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; border-top:1px solid #e2e8f0; padding-top:4px; margin-top:4px;">
            <span style="font-size:10px; font-weight:700; color:${mainColor};">
              ${statusText}
            </span>
            ${
              isDone
                ? `<span style="font-size:9.5px; font-weight:700; color:#059669;">
                    🛡️ ${warranty.daysRemaining}h
                  </span>`
                : ''
            }
          </div>
        </div>
      `;

      const marker = L.marker([item.lat, item.lng], { icon })
        .bindPopup(popupHtml, {
          autoPan: true,
          autoPanPaddingTopLeft: [50, 40],
          autoPanPaddingBottomRight: [40, 50],
          closeButton: true,
        })
        .addTo(layerGroup);

      marker.on('click', () => {
        if (onSelectMarker) {
          onSelectMarker(item.id);
        }
      });

      if (isSelected) {
        setTimeout(() => {
          marker.openPopup();
        }, 120);
      }
    });
  }, [items, selectedId, isPublicPortfolio, onSelectMarker, leafletReady]);

  // Focus camera when selectedId changes
  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current) return;
    const found = items.find((i) => i.id === selectedId);
    if (found && !isNaN(found.lat) && !isNaN(found.lng)) {
      const currentZoom = mapInstanceRef.current.getZoom();
      const targetZoom = currentZoom < 13 ? 14 : currentZoom;
      mapInstanceRef.current.flyTo([found.lat, found.lng], targetZoom, { duration: 0.7 });
    }
  }, [selectedId]);

  const handleQuickJump = (region: (typeof KALTIM_REGIONS)[number]) => {
    if (onCityQuickJump) {
      onCityQuickJump(region.key);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([region.lat, region.lng], region.zoom, { duration: 0.9 });
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      {/* SINGLE-ROW TOP TOOLBAR: Quick Jump Wilayah Kaltim (Left) + Layer Switcher (Right) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/20 px-3 py-2">
        {/* Left: Segmented Kaltim City Tabs */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground shrink-0">
            <Navigation className="h-3 w-3 text-teal-500" /> Wilayah
          </span>
          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar rounded-xl border border-border/80 bg-background/80 p-0.5">
            {KALTIM_REGIONS.map((reg) => {
              const isCurrent = activeCity === reg.key;
              return (
                <button
                  key={reg.key}
                  type="button"
                  onClick={() => handleQuickJump(reg)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0',
                    isCurrent
                      ? 'bg-teal-500 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  {reg.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Multi-Layer Basemap Switcher (Default: Jalanan) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-0.5 rounded-xl border border-border/80 bg-background/80 p-0.5">
            <button
              type="button"
              onClick={() => setTileMode('roadmap')}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                tileMode === 'roadmap'
                  ? 'bg-teal-500 text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <MapIcon className="h-3 w-3" /> Jalanan
            </button>
            <button
              type="button"
              onClick={() => setTileMode('satellite')}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                tileMode === 'satellite'
                  ? 'bg-teal-500 text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Satellite className="h-3 w-3" /> Satelit HD
            </button>
            <button
              type="button"
              onClick={() => setTileMode('dark')}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                tileMode === 'dark'
                  ? 'bg-teal-500 text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Moon className="h-3 w-3" /> Terrain
            </button>
          </div>
          {headerRightSlot}
        </div>
      </div>

      {/* UNIFIED SPLIT BODY: Map Canvas (Left, Flex-1) + Flush-Docked Inspector Panel (Right) */}
      <div className={cn('flex flex-col lg:flex-row w-full', heightClass)}>
        {/* Map Canvas */}
        <div className="relative flex-1 h-[420px] lg:h-full w-full bg-slate-900/40 min-w-0">
          <div ref={mapContainerRef} className="h-full w-full z-0" />

          {!leafletReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm z-20 gap-2">
              <Layers className="h-7 w-7 text-teal-500 animate-spin" />
              <span className="text-xs font-bold text-muted-foreground">
                Memuat Peta Geospasial Kalimantan Timur...
              </span>
            </div>
          )}

          {/* Bottom-left Traffic Light Status Legend */}
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md px-2.5 py-1.5 shadow-md text-[10px] font-bold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/30" />
              100% Aktif & Bergaransi
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block ring-2 ring-amber-500/30" />
              1–99% Sedang Pasang
            </span>
            {!isPublicPortfolio && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block ring-2 ring-rose-500/30" />
                  0% Antrean Survei
                </span>
              </>
            )}
            {isPublicPortfolio && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
                  <ShieldCheck className="h-3 w-3" /> Lokasi Disamarkan (Privasi Klien)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Flush-Docked Right Panel (No overlap with map canvas, top bar, or attribution!) */}
        {rightPanel && (
          <div className="w-full lg:w-[375px] xl:w-[390px] lg:h-full border-t lg:border-t-0 lg:border-l border-border/80 bg-card shrink-0 flex flex-col overflow-hidden">
            {rightPanel}
          </div>
        )}
      </div>
    </div>
  );
};
