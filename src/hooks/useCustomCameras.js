// src/hooks/useCustomCameras.js
// Manages user-added custom YouTube cameras persisted in localStorage.
// Works fully on Vercel (no backend needed). "Ben kendim" use case.

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'nooxcctv_custom_cameras_v1';

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
  const [customCameras, setCustomCameras] = useState([]);

  // Load on mount + listen for external changes (other tabs or our events)
  useEffect(() => {
    setCustomCameras(loadFromStorage());

    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setCustomCameras(loadFromStorage());
      }
    };
    const onCustomEvent = () => {
      setCustomCameras(loadFromStorage());
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('custom-cameras-changed', onCustomEvent);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('custom-cameras-changed', onCustomEvent);
    };
  }, []);

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

    // Build the embed url like the rest of the app
    newCam.embedUrl = `https://www.youtube.com/embed/${newCam.ytId}?autoplay=1&mute=1`;

    const updated = [...customCameras, newCam];
    setCustomCameras(updated);
    saveToStorage(updated);
    return newCam;
  }, [customCameras]);

  const removeCustomCamera = useCallback((id) => {
    const updated = customCameras.filter(c => c.id !== id);
    setCustomCameras(updated);
    saveToStorage(updated);
  }, [customCameras]);

  const clearAll = useCallback(() => {
    setCustomCameras([]);
    saveToStorage([]);
  }, []);

  // Convert to GeoJSON Feature format (for merging into globe data)
  const getAsFeatures = useCallback(() => {
    return customCameras.map((cam, i) => ({
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
        sceneType: 'user-added',
        sourceFamily: 'user-custom',
        status: 'custom',
        qualityTier: 'user',
        addedAt: cam.addedAt
      }
    }));
  }, [customCameras]);

  return {
    customCameras,
    addCustomCamera,
    removeCustomCamera,
    clearAll,
    getAsFeatures,
    count: customCameras.length
  };
}

export { extractYouTubeId };