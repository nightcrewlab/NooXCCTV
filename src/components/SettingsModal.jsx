// src/components/SettingsModal.jsx
// Ayarlar / Custom Camera Manager — fully cyberpunk themed, localStorage backed
// Works on Vercel production without any backend.

import { useState } from 'react';
import { useCustomCameras, extractYouTubeId } from '../hooks/useCustomCameras';

export default function SettingsModal({ isOpen, onClose }) {
  const {
    customCameras,
    addCustomCamera,
    removeCustomCamera,
    clearAll,
    count
  } = useCustomCameras();

  const [name, setName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [country, setCountry] = useState('US');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const extractedId = extractYouTubeId(youtubeUrl);
  const isValidYoutube = !!extractedId;

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Kamera adı gerekli');
      return;
    }
    if (!isValidYoutube) {
      setError('Geçerli bir YouTube linki veya video ID girin');
      return;
    }
    if (!lat || !lng) {
      setError('Enlem ve boylam girin (örnek: 36.1147, -115.1728)');
      return;
    }

    setIsAdding(true);
    try {
      const newCam = addCustomCamera({
        name: name.trim(),
        url: youtubeUrl.trim(),
        ytId: extractedId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        country: country.trim()
      });

      setSuccess(`Eklendi: ${newCam.name} — Haritada görünüyor`);
      // Reset form
      setName('');
      setYoutubeUrl('');
      setLat('');
      setLng('');
      // Keep country

      // Auto close success message after 2.5s
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err.message || 'Eklenemedi');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = (id, camName) => {
    if (confirm(`"${camName}" kamerasını silmek istiyor musun?`)) {
      removeCustomCamera(id);
    }
  };

  const handleClearAll = () => {
    if (confirm('Tüm özel kameralarını silmek istediğine emin misin? Bu geri alınamaz.')) {
      clearAll();
    }
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div>
            <span className="settings-title">// AYARLAR — ÖZEL YOUTUBE KAMERALARI</span>
            <span className="settings-subtitle">Sadece YouTube Live • localStorage ile kalıcı (Vercel uyumlu)</span>
          </div>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* Add new camera form */}
          <div className="settings-section">
            <div className="section-title">YENİ KAMERA EKLE</div>

            <form onSubmit={handleAdd} className="add-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Kamera Adı</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Las Vegas - Bellagio Fountains"
                    required
                  />
                </div>
                <div className="form-group small">
                  <label>Ülke Kodu</label>
                  <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="US"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>YouTube Live Linki veya Video ID</label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX veya sadece video ID"
                  required
                />
                {isValidYoutube && (
                  <div className="yt-preview">
                    ✓ ID doğrulandı: <strong>{extractedId}</strong>
                    <div className="yt-mini">
                      <iframe
                        width="100%"
                        height="120"
                        src={`https://www.youtube.com/embed/${extractedId}?autoplay=0&mute=1`}
                        title="YouTube preview"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row coords">
                <div className="form-group">
                  <label>Enlem (Latitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                    placeholder="36.1147"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Boylam (Longitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                    placeholder="-115.1728"
                    required
                  />
                </div>
              </div>

              {error && <div className="form-error">⚠ {error}</div>}
              {success && <div className="form-success">✓ {success}</div>}

              <button
                type="submit"
                className="btn-primary"
                disabled={isAdding || !name.trim() || !isValidYoutube || !lat || !lng}
              >
                {isAdding ? 'EKLENİYOR...' : 'HARİTAYA EKLE VE KAYDET'}
              </button>
              <div className="form-hint">
                Eklediğin kamera anında haritada kırmızı pin olarak görünecek. Tarayıcıda kalıcıdır.
              </div>
            </form>
          </div>

          {/* Existing custom cameras list */}
          <div className="settings-section">
            <div className="section-title">
              KAYITLI ÖZEL KAMERALARIN <span className="count">({count})</span>
            </div>

            {count === 0 ? (
              <div className="empty-state">
                Henüz özel kamera eklemedin.<br />
                Yukarıdaki formu kullanarak istediğin YouTube live'ları haritaya sabitleyebilirsin.
              </div>
            ) : (
              <div className="custom-list">
                {customCameras.map(cam => (
                  <div key={cam.id} className="custom-item">
                    <div className="custom-info">
                      <div className="custom-name">{cam.name}</div>
                      <div className="custom-meta">
                        {cam.country} • {cam.lat.toFixed(4)}, {cam.lng.toFixed(4)}
                        <span className="added"> • {formatDate(cam.addedAt)}</span>
                      </div>
                      <div className="custom-url">
                        youtube.com/embed/{cam.ytId}
                      </div>
                    </div>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(cam.id, cam.name)}
                      title="Sil"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {count > 0 && (
              <button className="btn-danger" onClick={handleClearAll}>
                TÜM ÖZEL KAMERALARI SİL
              </button>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <div>Veriler sadece bu tarayıcıda saklanır (localStorage). Farklı cihazlarda görünmez.</div>
          <div className="hint">Kapatmak için dışarı tıkla veya ESC</div>
        </div>
      </div>
    </div>
  );
}
