import { useState, useEffect } from 'react';
import RouletteWheel from './RouletteWheel';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<RouletteData[]>([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [shouldResetTonearm, setShouldResetTonearm] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState<'33' | '45'>('33');
  const [isManualStop, setIsManualStop] = useState(false);

  // Get the base path from Vite config (handles GitHub Pages deployment)
  const basePath = import.meta.env.BASE_URL || '/';

  // Get username from URL path (e.g., /vinyl-roulette/username) or localStorage
  const getUsernameFromUrl = (): string => {
    const path = window.location.pathname;
    // Remove base path and get the remaining segment
    const pathWithoutBase = path.replace(basePath, '').replace(/^\/+/, '');
    const pathSegment = pathWithoutBase.split('/').filter(Boolean)[0];
    return pathSegment || '';
  };

  // Username state
  const [username, setUsername] = useState<string>(() => {
    const urlUsername = getUsernameFromUrl();
    if (urlUsername) {
      // Store URL username in localStorage for future visits
      localStorage.setItem('discogs_username', urlUsername);
      return urlUsername;
    }
    return localStorage.getItem('discogs_username') || '';
  });
  const [isConfigured, setIsConfigured] = useState<boolean>(!!username);
  const [inputUsername, setInputUsername] = useState(username);

  // Update URL when username changes
  const updateUrl = (newUsername: string) => {
    const newPath = newUsername
      ? `${basePath}${encodeURIComponent(newUsername)}`
      : basePath;
    window.history.pushState({}, '', newPath);
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlUsername = getUsernameFromUrl();
      if (urlUsername && urlUsername !== username) {
        setUsername(urlUsername);
        setIsConfigured(true);
        localStorage.setItem('discogs_username', urlUsername);
      } else if (!urlUsername) {
        setIsConfigured(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [username]);

  useEffect(() => {
    if (!isConfigured || !username) return;

    const loadCollection = async () => {
      setLoading(true);
      try {
        const collection = await fetchCollection(username);
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
        setError(null);
      } catch (err) {
        setError('Failed to load your collection. Please check your Discogs username.');
        // If fetch fails, we might want to let them try again / change user
      } finally {
        setLoading(false);
      }
    };

    loadCollection();
  }, [username, isConfigured]);

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
      if (event.code === 'Space' && !mustSpin && filteredData.length > 0 && !isModalOpen && isConfigured) {
        event.preventDefault();
        handleSpinClick();
      }
      // ESC to close modal
      if (event.code === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
        setShouldResetTonearm(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mustSpin, filteredData, isModalOpen, isConfigured]);

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
      setShouldResetTonearm(false);
      setIsManualStop(false);

      // Start loading the album details immediately
      const selectedAlbum = filteredData[newPrizeNumber];
      setIsLoadingDetails(true);
      fetchReleaseDetails(selectedAlbum.id)
        .then(details => {
          // Preload the album art image into browser cache
          if (details?.images && details.images.length > 0) {
            const img = new Image();
            img.src = details.images[0].resource_url;
          }
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
    // Delay modal opening to allow tonearm animation to complete
    setTimeout(() => {
      setIsModalOpen(true);
    }, 1000); // 1 second delay
  };

  const handleSpeedToggle = () => {
    setSpinSpeed(prev => prev === '33' ? '45' : '33');
  };

  const getSpinDuration = () => spinSpeed === '33' ? 2.0 : 1.0;

  const handleStopClick = () => {
    if (mustSpin && !isManualStop) {
      setIsManualStop(true);
    }
  };

  const handleStopComplete = () => {
    setMustSpin(false);
    setIsManualStop(false);
    setSelectedAlbum(filteredData[prizeNumber]);
    setTimeout(() => setIsModalOpen(true), 1000);
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUsername.trim()) {
      const newUsername = inputUsername.trim();
      localStorage.setItem('discogs_username', newUsername);
      setUsername(newUsername);
      setIsConfigured(true);
      setError(null); // Clear any previous errors
      updateUrl(newUsername);
    }
  };

  const handleChangeUser = () => {
    setIsConfigured(false);
    setInputUsername('');
    setError(null); // Clear any previous errors
    updateUrl(''); // Clear URL path
    // Clear data to avoid showing old data while new data loads
    setData([]);
    setFilteredData([]);
    setWheelData([]);
    setSelectedGenres([]);
    setAvailableGenres([]);
  };

  if (!isConfigured) {
    return (
      <div className="discogs-roulette-container">
        <div className="username-form-container">
          <h1>Welcome to Vinyl Roulette</h1>
          <p>Enter your Discogs username to spin your collection</p>
          <form onSubmit={handleUsernameSubmit} className="username-form">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Discogs Username"
              className="username-input"
              autoFocus
            />
            <button type="submit" className="username-submit-btn" disabled={!inputUsername.trim()}>
              Load Collection
            </button>
          </form>

          <div className="help-section">
            <h3>How to connect your Discogs collection</h3>
            <ol className="help-steps">
              <li>
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Create a Discogs account</strong>
                  <p>If you don't have one, sign up at <a href="https://www.discogs.com/users/create" target="_blank" rel="noopener noreferrer">discogs.com</a></p>
                </div>
              </li>
              <li>
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>Add records to your collection</strong>
                  <p>Search for albums and click "Add to Collection"</p>
                </div>
              </li>
              <li>
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Make your collection public</strong>
                  <p>Go to <a href="https://www.discogs.com/settings/privacy" target="_blank" rel="noopener noreferrer">Settings → Privacy</a> and set your Collection to <strong>"Public"</strong></p>
                </div>
              </li>
              <li>
                <span className="step-number">4</span>
                <div className="step-content">
                  <strong>Enter your username above</strong>
                  <p>Your username is shown in your profile URL: discogs.com/user/<em>username</em></p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading your vinyl collection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="discogs-roulette-container">
        <div className="error-page-container">
          <div className="error-message">
            <span className="error-icon">!</span>
            <div>{error}</div>
          </div>
          <button className="change-user-btn error-btn" onClick={handleChangeUser}>
            Try Different Username
          </button>

          <div className="help-section">
            <h3>Troubleshooting</h3>
            <ol className="help-steps">
              <li>
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Check your username</strong>
                  <p>Your username is in your profile URL: discogs.com/user/<em>username</em></p>
                </div>
              </li>
              <li>
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>Make sure your collection is public</strong>
                  <p>Go to <a href="https://www.discogs.com/settings/privacy" target="_blank" rel="noopener noreferrer">Settings → Privacy</a> and set Collection to <strong>"Public"</strong></p>
                </div>
              </li>
              <li>
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Add some records</strong>
                  <p>Your collection needs at least one album to spin the wheel</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="discogs-roulette-container">
        <div className="error-page-container">
          <div className="error-message">
            <span className="error-icon">0</span>
            <div>No albums found in your collection.</div>
          </div>
          <button className="change-user-btn error-btn" onClick={handleChangeUser}>
            Try Different Username
          </button>

          <div className="help-section">
            <h3>How to add albums</h3>
            <ol className="help-steps">
              <li>
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Search for albums on Discogs</strong>
                  <p>Go to <a href="https://www.discogs.com/search" target="_blank" rel="noopener noreferrer">discogs.com/search</a> and find your vinyl records</p>
                </div>
              </li>
              <li>
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>Add to your collection</strong>
                  <p>Click "Add to Collection" on each album page</p>
                </div>
              </li>
              <li>
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Make sure it's public</strong>
                  <p>Check <a href="https://www.discogs.com/settings/privacy" target="_blank" rel="noopener noreferrer">Settings → Privacy</a> and set Collection to <strong>"Public"</strong></p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="discogs-roulette-container">
      <div className="header">
        <h1>Vinyl Roulette</h1>
        <div className="user-info-header">
           <span>Collection: <strong>{username}</strong></span>
           <button className="change-user-link" onClick={handleChangeUser}>(Change)</button>
        </div>
        <div className="collection-info">
          {selectedGenres.length > 0 ? (
            <span>Spinning from {filteredData.length} of {data.length} albums</span>
          ) : (
            <span>{data.length} albums in your collection</span>
          )}
        </div>
      </div>

      {availableGenres.length > 0 && (
        <div className={`genre-filter ${isFilterExpanded ? 'expanded' : 'collapsed'}`}>
          <button
            className="filter-toggle"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <span className="filter-toggle-label">
              Filter by Genre
              {selectedGenres.length > 0 && (
                <span className="filter-count">{selectedGenres.length}</span>
              )}
            </span>
            <span className={`filter-toggle-icon ${isFilterExpanded ? 'expanded' : ''}`}>▼</span>
          </button>
          <div className="filter-content">
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
            {selectedGenres.length > 0 && (
              <button className="clear-filters-btn" onClick={handleClearFilters}>
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`wheel-container ${mustSpin ? 'spinning' : ''}`}>
        <RouletteWheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeNumber}
          data={wheelData}
          onStopSpinning={handleSpinStop}
          shouldStop={isManualStop}
          onStopComplete={handleStopComplete}
          resetTonearm={shouldResetTonearm}
          spinSpeed={spinSpeed}
          onSpeedToggle={handleSpeedToggle}
          onStopClick={handleStopClick}
          onStartClick={handleSpinClick}
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
          outerBorderColor="#1a1a1a"
          outerBorderWidth={4}
          innerBorderColor="#2C3E50"
          radiusLineColor="rgba(0,0,0,0.3)"
          radiusLineWidth={2}
          fontSize={11}
          spinDuration={getSpinDuration()}
          textDistance={85}
          perpendicularText={false}
          enableSound={true}
        />
      </div>

      {filteredData.length === 0 && (
        <div className="no-results-message">
          No albums match the selected genres. Try different filters!
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setShouldResetTonearm(true);
      }}>
        {selectedAlbum && (
          <div className="album-details">
            <h2>Your Next Vinyl</h2>
            <p className="album-title">{selectedAlbum.option}</p>
            {isLoadingDetails ? (
              <div className="loading-image">Loading album details...</div>
            ) : (
              <>
                {selectedAlbumDetails?.images && selectedAlbumDetails.images.length > 0 && (
                  <div className="album-image-container">
                    <div className="vinyl-disc"></div>
                    <img
                      src={selectedAlbumDetails.images[0].resource_url}
                      alt={selectedAlbum.option}
                      className="album-image"
                    />
                  </div>
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
                    <ul className="track-list">
                      {selectedAlbumDetails.tracklist.map((track, index) => (
                        <li key={index} className="track-item">
                          {track.position && (
                            <span className="track-position">{track.position}</span>
                          )}
                          <span className="track-title">{track.title}</span>
                          {track.duration && (
                            <span className="track-duration">{track.duration}</span>
                          )}
                        </li>
                      ))}
                    </ul>
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
