// src/hooks/useCustomCameras.js
// - Base cameras come from public/custom-cameras.json (committed to repo, always present)
// - User additions are stored in localStorage (personal, survives refresh)
// Works fully on Vercel.

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'nooxcctv_custom_cameras_v1';
const BASE_JSON_URL = '/custom-cameras.json';

function extractYouTubeId(input) {
  if (!input) return null;
  const s = String(input).trim();

  // Direct ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  // Common patterns
  const patterns = [
    /(?:v=|youtu\.be\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // Notify other parts of the app (same tab)
    window.dispatchEvent(new CustomEvent('custom-cameras-changed', { detail: { count: list.length } }));
  } catch (e) {
    console.warn('Failed to save custom cameras:', e);
  }
}

export function useCustomCameras() {
  const [baseCameras, setBaseCameras] = useState([]);
  const [userCameras, setUserCameras] = useState([]);

  // Load base from JSON file + user additions from localStorage
  useEffect(() => {
    let cancelled = false;

    // Load base cameras from public/custom-cameras.json
    fetch(BASE_JSON_URL)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!cancelled && Array.isArray(data)) {
          const normalized = data.map((c, idx) => ({
            id: `base-${idx}`,
            name: c.name,
            lat: Number(c.lat),
            lng: Number(c.lng),
            ytId: c.ytId,
            country: (c.country || 'XX').toUpperCase().slice(0, 2),
            embedUrl: `https://www.youtube.com/embed/${c.ytId}?autoplay=1&mute=1`,
            isBase: true
          }));
          setBaseCameras(normalized);
        }
      })
      .catch(() => {});

    // Load user additions from localStorage
    const user = loadFromStorage();
    setUserCameras(user);

    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setUserCameras(loadFromStorage());
      }
    };
    const onCustomEvent = () => {
      setUserCameras(loadFromStorage());
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('custom-cameras-changed', onCustomEvent);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('custom-cameras-changed', onCustomEvent);
    };
  }, []);

  // Combined list for map (base first, then user additions)
  const customCameras = [...baseCameras, ...userCameras];

  // Add only goes to localStorage (user additions)
  const addCustomCamera = useCallback((camera) => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newCam = {
      id,
      name: camera.name?.trim() || 'Custom Camera',
      lat: Number(camera.lat),
      lng: Number(camera.lng),
      url: camera.url,
      ytId: camera.ytId || extractYouTubeId(camera.url),
      country: (camera.country || 'XX').toUpperCase().slice(0, 2),
      addedAt: new Date().toISOString(),
    };

    if (!newCam.ytId) {
      throw new Error('Geçerli bir YouTube linki girin (video ID bulunamadı)');
    }
    if (isNaN(newCam.lat) || isNaN(newCam.lng)) {
      throw new Error('Geçerli enlem ve boylam girin');
    }

    newCam.embedUrl = `https://www.youtube.com/embed/${newCam.ytId}?autoplay=1&mute=1`;

    const updated = [...userCameras, newCam];
    setUserCameras(updated);
    saveToStorage(updated);
    return newCam;
  }, [userCameras]);

  // Remove only works on user-added cameras (base cameras from JSON cannot be deleted from UI)
  const removeCustomCamera = useCallback((id) => {
    const updated = userCameras.filter(c => c.id !== id);
    setUserCameras(updated);
    saveToStorage(updated);
  }, [userCameras]);

  const clearAll = useCallback(() => {
    setUserCameras([]);
    saveToStorage([]);
  }, []);

  // Convert to GeoJSON Feature format (used by useStreams)
  const getAsFeatures = useCallback(() => {
    return customCameras.map((cam) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cam.lng, cam.lat]
      },
      properties: {
        id: cam.id,
        name: cam.name,
        fullName: cam.name,
        url: cam.embedUrl || cam.url,
        embedType: 'youtube',
        ytId: cam.ytId,
        country: cam.country,
        environment: 'custom',
        sceneType: cam.isBase ? 'project-base' : 'user-added',
        sourceFamily: cam.isBase ? 'project-custom' : 'user-custom',
        status: cam.isBase ? 'base' : 'custom',
        qualityTier: 'user'
      }
    }));
  }, [customCameras]);

  // Export only user's local additions as clean JSON
  const exportUserCameras = useCallback(() => {
    const exportData = userCameras.map(c => ({
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      ytId: c.ytId,
      country: c.country
    }));
    return JSON.stringify(exportData, null, 2);
  }, [userCameras]);

  return {
    customCameras,
    baseCameras,
    userCameras,
    addCustomCamera,
    removeCustomCamera,
    clearAll,
    getAsFeatures,
    exportUserCameras,
    count: customCameras.length,
    userCount: userCameras.length
  };
}

export { extractYouTubeId };