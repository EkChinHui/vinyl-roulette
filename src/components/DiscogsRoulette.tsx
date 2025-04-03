import { useState, useEffect } from 'react';
import { Wheel } from 'react-custom-roulette';
import { fetchCollection, fetchReleaseDetails, RouletteData, ReleaseDetails } from '../services/discogsService';
import Modal from './Modal';
import '../styles/DiscogsRoulette.css';

interface WheelData {
  option: string;
}

const truncateText = (text: string, maxLength: number = 20): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

const DiscogsRoulette = () => {
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [data, setData] = useState<RouletteData[]>([]);
  const [wheelData, setWheelData] = useState<WheelData[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<RouletteData | null>(null);
  const [selectedAlbumDetails, setSelectedAlbumDetails] = useState<ReleaseDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const loadCollection = async () => {
      try {
        const collection = await fetchCollection();
        setData(collection);
        setWheelData(collection.map(album => ({
          option: truncateText(album.basic_information.title)
        })));
        setLoading(false);
      } catch (err) {
        setError('Failed to load your collection. Please check your Discogs username.');
        setLoading(false);
      }
    };

    loadCollection();
  }, []);

  const handleSpinClick = () => {
    if (!mustSpin && data.length > 0) {
      const newPrizeNumber = Math.floor(Math.random() * data.length);
      setPrizeNumber(newPrizeNumber);
      setMustSpin(true);
      setSelectedAlbum(null);
      setSelectedAlbumDetails(null);
      setIsModalOpen(false);

      // Start loading the album details immediately
      const selectedAlbum = data[newPrizeNumber];
      setIsLoadingDetails(true);
      fetchReleaseDetails(selectedAlbum.id)
        .then(details => {
          setSelectedAlbumDetails(details);
          setIsLoadingDetails(false);
        })
        .catch(err => {
          console.error('Failed to fetch album details:', err);
          setIsLoadingDetails(false);
        });
    }
  };

  const handleSpinStop = () => {
    setMustSpin(false);
    setSelectedAlbum(data[prizeNumber]);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">Loading your vinyl collection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div>{error}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="error-container">
        <div>No albums found in your collection.</div>
      </div>
    );
  }

  return (
    <div className="discogs-roulette-container">
      <div className="header">
        <h1>Vinyl Roulette</h1>
      </div>
      
      <div className="wheel-container">
        <Wheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeNumber}
          data={wheelData}
          onStopSpinning={handleSpinStop}
          backgroundColors={[
            '#2C3E50', // Dark blue
            '#E74C3C', // Coral red
            '#2980B9', // Ocean blue
            '#F1C40F', // Sunflower yellow
            '#27AE60', // Emerald green
            '#8E44AD', // Purple
            '#D35400', // Pumpkin orange
            '#16A085', // Green sea
            '#C0392B', // Dark red
            '#2980B9', // Ocean blue
            '#F39C12', // Orange
            '#2ECC71'  // Green
          ]}
          textColors={['#ffffff']}
          outerBorderColor="#2C3E50"
          outerBorderWidth={3}
          innerBorderColor="#2C3E50"
          radiusLineColor="#2C3E50"
          radiusLineWidth={1}
          fontSize={12}
          spinDuration={0.8}
          textDistance={60}
          perpendicularText={false}
        />
      </div>

      <button
        className="spin-button"
        onClick={handleSpinClick}
        disabled={mustSpin}
      >
        {mustSpin ? 'Spinning...' : 'Spin the Wheel'}
      </button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {selectedAlbum && (
          <div className="album-details">
            <h2>Your Next Vinyl</h2>
            <p>{selectedAlbum.option}</p>
            {isLoadingDetails ? (
              <div className="loading-image">Loading album details...</div>
            ) : (
              selectedAlbumDetails?.images && selectedAlbumDetails.images.length > 0 && (
                <img
                  src={selectedAlbumDetails.images[0].resource_url}
                  alt={selectedAlbum.option}
                  className="album-image"
                />
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DiscogsRoulette; 