// src/components/Globe.jsx
import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { createRoot } from 'react-dom/client';
import CCTVPopup from './CCTVPopup';

mapboxgl.accessToken = 'pk.eyJ1Ijoibm9veHJpaSIsImEiOiJjbXBidGdubnEwMTNrMnJzYjFqc2ltOTg2In0.8N9W8DrKzdOgX6Om9DFLFQ';

const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 50;

export default function Globe({ geojson }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const popupRootRef = useRef(null);
  const popupElRef = useRef(null);
  const geojsonRef = useRef(null);

  geojsonRef.current = geojson;

  const closePopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (popupRootRef.current) {
      try { popupRootRef.current.unmount(); } catch {}
      popupRootRef.current = null;
    }
    popupElRef.current = null;
  }, []);

  const openPopup = useCallback((map, feature, lngLat) => {
    closePopup();
    const el = document.createElement('div');
    popupElRef.current = el;
    const root = createRoot(el);
    popupRootRef.current = root;
    root.render(<CCTVPopup feature={feature} onClose={closePopup} />);
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: 'none',
      offset: [0, -10],
      anchor: 'bottom'
    })
      .setLngLat(lngLat)
      .setDOMContent(el)
      .addTo(map);
    popupRef.current = popup;
  }, [closePopup]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [20, 20],
      zoom: 1.5,
      projection: 'globe',
      fog: {
        'color': 'rgb(2, 5, 20)',
        'high-color': 'rgb(0, 30, 80)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(0, 0, 8)',
        'star-intensity': 0.8
      }
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'bottom-right');
    map.on('click', closePopup);

    map.once('style.load', () => {
      map.setFog({
        'color': 'rgb(2, 5, 20)',
        'high-color': 'rgb(0, 30, 80)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(0, 0, 8)',
        'star-intensity': 0.8
      });

      const EMPTY = { type: 'FeatureCollection', features: [] };
      map.addSource('cameras', {
        type: 'geojson',
        data: geojsonRef.current || EMPTY,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS
      });

      // Cluster katmanları (renkler değişmedi)
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'cameras',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#00c8ff',
            5, '#0090cc',
            20, '#006699'
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 20, 30],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(0, 200, 255, 0.5)',
          'circle-opacity': 0.85
        }
      });
      map.addLayer({
        id: 'clusters-pulse',
        type: 'circle',
        source: 'cameras',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'transparent',
          'circle-radius': ['step', ['get', 'point_count'], 24, 5, 30, 20, 38],
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(0, 200, 255, 0.25)',
          'circle-opacity': 0
        }
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'cameras',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: { 'text-color': '#ffffff' }
      });

      // Bireysel kamera katmanı - RENK DİNAMİK: YouTube ise kırmızı, değilse mavi
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'cameras',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            // Doğrudan YouTube embed ise kırmızı
            ['==', ['get', 'embedType'], 'youtube'], '#ff2d55',
            // SkylineWebcams kaynaklı ise turuncu (içinde YouTube çıkabilir)
            ['==', ['get', 'sourceFamily'], 'skylinewebcams'], '#ffb700',
            // Diğer tüm durumlar mavi
            '#00c8ff'
          ],
          'circle-radius': 6,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'embedType'], 'youtube'], 'rgba(255, 45, 85, 0.8)',
            ['==', ['get', 'sourceFamily'], 'skylinewebcams'], 'rgba(255, 183, 0, 0.6)',
            'rgba(0, 200, 255, 0.6)'
          ],
          'circle-opacity': 0.9
        }
      });

      // Dış halka (pulse) - aynı renk mantığı
      map.addLayer({
        id: 'unclustered-pulse',
        type: 'circle',
        source: 'cameras',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': 'transparent',
          'circle-radius': 12,
          'circle-stroke-width': 1,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'embedType'], 'youtube'], 'rgba(255, 45, 85, 0.4)',
            ['==', ['get', 'sourceFamily'], 'skylinewebcams'], 'rgba(255, 183, 0, 0.3)',
            'rgba(0, 200, 255, 0.3)'
          ],
        }
      });

      // Tıklama olayları
      map.on('click', 'clusters', (e) => {
        e.preventDefault();
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        map.getSource('cameras').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: features[0].geometry.coordinates, zoom: Math.min(zoom + 1, 16), duration: 600 });
        });
      });

      map.on('click', 'unclustered-point', (e) => {
        e.preventDefault();
        const feature = e.features[0];
        const coords = feature.geometry.coordinates.slice();
        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }
        openPopup(map, feature, coords);
      });

      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'crosshair'; });
      map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; });
    });

    // Otomatik döndürme
    let rotating = true;
    let frame;
    function rotate() {
      if (!rotating) return;
      const center = map.getCenter();
      map.setCenter([center.lng + 0.02, center.lat]);
      frame = requestAnimationFrame(rotate);
    }
    map.on('mousedown', () => { rotating = false; cancelAnimationFrame(frame); });
    map.on('touchstart', () => { rotating = false; cancelAnimationFrame(frame); });
    map.on('load', () => { setTimeout(() => { frame = requestAnimationFrame(rotate); }, 3500); });

    return () => {
      rotating = false;
      cancelAnimationFrame(frame);
      closePopup();
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    function apply() {
      const src = map.getSource('cameras');
      if (src) {
        src.setData(geojson);
        return true;
      }
      return false;
    }
    if (!apply()) {
      const onStyleLoad = () => { apply(); };
      map.once('style.load', onStyleLoad);
      return () => { map.off('style.load', onStyleLoad); };
    }
  }, [geojson]);

  return <div id="map-container" ref={mapContainerRef} />;
}