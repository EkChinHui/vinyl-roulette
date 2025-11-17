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
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<RouletteData[]>([]);

  useEffect(() => {
    const loadCollection = async () => {
      try {
        const collection = await fetchCollection();
        setData(collection);
        setFilteredData(collection);
        setWheelData(collection.map(album => ({
          option: truncateText(album.basic_information.title)
        })));

        // Extract unique genres from collection
        const genresSet = new Set<string>();
        collection.forEach(album => {
          if (album.basic_information.genres) {
            album.basic_information.genres.forEach(genre => genresSet.add(genre));
          }
        });
        setAvailableGenres(Array.from(genresSet).sort());

        setLoading(false);
      } catch (err) {
        setError('Failed to load your collection. Please check your Discogs username.');
        setLoading(false);
      }
    };

    loadCollection();
  }, []);

  // Filter data when selected genres change
  useEffect(() => {
    if (selectedGenres.length === 0) {
      setFilteredData(data);
      setWheelData(data.map(album => ({
        option: truncateText(album.basic_information.title)
      })));
    } else {
      const filtered = data.filter(album => {
        if (!album.basic_information.genres) return false;
        return album.basic_information.genres.some(genre =>
          selectedGenres.includes(genre)
        );
      });
      setFilteredData(filtered);
      setWheelData(filtered.map(album => ({
        option: truncateText(album.basic_information.title)
      })));
    }
  }, [selectedGenres, data]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Spacebar to spin
      if (event.code === 'Space' && !mustSpin && filteredData.length > 0 && !isModalOpen) {
        event.preventDefault();
        handleSpinClick();
      }
      // ESC to close modal
      if (event.code === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mustSpin, filteredData, isModalOpen]);

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleClearFilters = () => {
    setSelectedGenres([]);
  };

  const handleSpinClick = () => {
    if (!mustSpin && filteredData.length > 0) {
      const newPrizeNumber = Math.floor(Math.random() * filteredData.length);
      setPrizeNumber(newPrizeNumber);
      setMustSpin(true);
      setSelectedAlbum(null);
      setSelectedAlbumDetails(null);
      setIsModalOpen(false);

      // Start loading the album details immediately
      const selectedAlbum = filteredData[newPrizeNumber];
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
    setSelectedAlbum(filteredData[prizeNumber]);
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
        <div className="collection-info">
          {selectedGenres.length > 0 ? (
            <span>Spinning from {filteredData.length} of {data.length} albums</span>
          ) : (
            <span>{data.length} albums in your collection</span>
          )}
        </div>
      </div>

      {availableGenres.length > 0 && (
        <div className="genre-filter">
          <div className="filter-header">
            <span className="filter-label">Filter by Genre:</span>
            {selectedGenres.length > 0 && (
              <button className="clear-filters-btn" onClick={handleClearFilters}>
                Clear All
              </button>
            )}
          </div>
          <div className="genre-filter-tags">
            {availableGenres.map(genre => (
              <button
                key={genre}
                className={`genre-filter-tag ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                onClick={() => handleGenreToggle(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {filteredData.length === 0 ? (
        <div className="no-results-message">
          No albums match the selected genres. Try different filters!
        </div>
      ) : (
        <button
          className="spin-button"
          onClick={handleSpinClick}
          disabled={mustSpin}
        >
          {mustSpin ? 'Spinning...' : 'Spin the Wheel'}
        </button>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {selectedAlbum && (
          <div className="album-details">
            <h2>Your Next Vinyl</h2>
            <p className="album-title">{selectedAlbum.option}</p>
            {isLoadingDetails ? (
              <div className="loading-image">Loading album details...</div>
            ) : (
              <>
                {selectedAlbumDetails?.images && selectedAlbumDetails.images.length > 0 && (
                  <img
                    src={selectedAlbumDetails.images[0].resource_url}
                    alt={selectedAlbum.option}
                    className="album-image"
                  />
                )}

                {selectedAlbumDetails?.genres && selectedAlbumDetails.genres.length > 0 && (
                  <div className="album-genres">
                    <h3>Genre</h3>
                    <div className="genre-tags">
                      {selectedAlbumDetails.genres.map((genre, index) => (
                        <span key={index} className="genre-tag">{genre}</span>
                      ))}
                      {selectedAlbumDetails.styles && selectedAlbumDetails.styles.map((style, index) => (
                        <span key={`style-${index}`} className="style-tag">{style}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAlbumDetails?.tracklist && selectedAlbumDetails.tracklist.length > 0 && (
                  <div className="album-tracklist">
                    <h3>Tracklist</h3>
                    <ol className="track-list">
                      {selectedAlbumDetails.tracklist.map((track, index) => (
                        <li key={index} className="track-item">
                          <span className="track-title">{track.title}</span>
                          {track.duration && (
                            <span className="track-duration">{track.duration}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DiscogsRoulette; 