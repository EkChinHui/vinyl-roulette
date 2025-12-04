import { useState, useEffect, useRef } from 'react';
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
  const [isRouletteMode, setIsRouletteMode] = useState(false); // true = roulette spin, false = cosmetic spin
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
  const [isWheelTransitioning, setIsWheelTransitioning] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const prevFilteredLength = useRef<number>(0);

  // Detect screen size for responsive help display and filter state
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobile = window.innerWidth <= 900;
      setIsMobileOrTablet(isMobile);
      // Keep filter expanded on mobile/tablet since there's more vertical space
      setIsFilterExpanded(isMobile);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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
    let newFilteredData: RouletteData[];

    if (selectedGenres.length === 0) {
      newFilteredData = data;
    } else {
      newFilteredData = data.filter(album => {
        if (!album.basic_information.genres) return false;
        return album.basic_information.genres.some(genre =>
          selectedGenres.includes(genre)
        );
      });
    }

    // Trigger wheel transition animation if the count changed
    if (prevFilteredLength.current !== 0 && prevFilteredLength.current !== newFilteredData.length) {
      setIsWheelTransitioning(true);
      setTimeout(() => setIsWheelTransitioning(false), 400);
    }
    prevFilteredLength.current = newFilteredData.length;

    setFilteredData(newFilteredData);
    setWheelData(newFilteredData.map(album => ({
      option: truncateText(album.basic_information.title)
    })));
  }, [selectedGenres, data]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Spacebar to spin roulette
      if (event.code === 'Space' && !mustSpin && filteredData.length > 0 && !isModalOpen && isConfigured) {
        event.preventDefault();
        handleWheelClick();
      }
      // ESC to close modal or help
      if (event.code === 'Escape') {
        if (isHelpOpen) {
          setIsHelpOpen(false);
        } else if (isModalOpen) {
          setIsModalOpen(false);
          setShouldResetTonearm(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mustSpin, filteredData, isModalOpen, isConfigured, isHelpOpen]);

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

  // Start button - just start spinning (cosmetic mode)
  const handleStartClick = () => {
    if (!mustSpin && filteredData.length > 0) {
      setIsRouletteMode(false); // Cosmetic mode
      setMustSpin(true);
      setShouldResetTonearm(false);
      setIsManualStop(false);
    }
  };

  // Click on wheel - roulette mode (spin and select album)
  const handleWheelClick = () => {
    if (!mustSpin && filteredData.length > 0) {
      const newPrizeNumber = Math.floor(Math.random() * filteredData.length);
      setPrizeNumber(newPrizeNumber);
      setIsRouletteMode(true); // Roulette mode
      setMustSpin(true);
      setSelectedAlbum(null);
      setSelectedAlbumDetails(null);
      setIsModalOpen(false);
      setShouldResetTonearm(false);
      setIsManualStop(false);

      // Start loading the album details immediately
      const album = filteredData[newPrizeNumber];
      setIsLoadingDetails(true);
      fetchReleaseDetails(album.id)
        .then(details => {
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

  // Roulette spin complete - show album
  const handleRouletteComplete = () => {
    setMustSpin(false);
    setSelectedAlbum(filteredData[prizeNumber]);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 1000);
  };

  const handleSpeedToggle = () => {
    setSpinSpeed(prev => prev === '33' ? '45' : '33');
  };

  // Stop button - stop spinning and disengage tonearm (cosmetic mode only)
  const handleStopClick = () => {
    if (mustSpin && !isManualStop && !isRouletteMode) {
      setIsManualStop(true);
    }
  };

  // Cosmetic stop complete - select the album it stopped on
  const handleStopComplete = (stoppedIndex: number) => {
    setMustSpin(false);
    setIsManualStop(false);
    setIsRouletteMode(false);

    // Select the album at the stopped position
    if (filteredData.length > 0 && stoppedIndex >= 0 && stoppedIndex < filteredData.length) {
      const album = filteredData[stoppedIndex];
      setSelectedAlbum(album);
      setPrizeNumber(stoppedIndex);

      // Fetch album details
      setIsLoadingDetails(true);
      fetchReleaseDetails(album.id)
        .then(details => {
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

      // Show modal after a brief delay
      setTimeout(() => {
        setIsModalOpen(true);
      }, 500);
    }
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
        <div className="collection-header">
          <button className="username-row" onClick={handleChangeUser}>
            <span className="username">{username}</span>
            <svg className="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button className="album-count-row" onClick={() => setIsCollectionModalOpen(true)}>
            {selectedGenres.length > 0 ? (
              <span key={`filtered-${filteredData.length}`}>{filteredData.length} of {data.length} albums</span>
            ) : (
              <span key="all">{data.length} albums</span>
            )}
            <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <button className="help-button" onClick={() => setIsHelpOpen(true)} aria-label="Help">
        ?
      </button>

      {isHelpOpen && (
        isMobileOrTablet ? (
          <div className="help-modal-overlay" onClick={() => setIsHelpOpen(false)}>
            <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="help-modal-header">
                <h2>How to Use</h2>
                <button className="help-modal-close" onClick={() => setIsHelpOpen(false)}>×</button>
              </div>
              <div className="help-modal-items">
                <div className="help-modal-item">
                  <div className="help-modal-icon">&#9673;</div>
                  <div className="help-modal-text">
                    <h3>Click the Record</h3>
                    <p>Spin the roulette to randomly select an album from your collection</p>
                  </div>
                </div>
                <div className="help-modal-item">
                  <div className="help-modal-icon">&#9654;</div>
                  <div className="help-modal-text">
                    <h3>Playback Controls</h3>
                    <p>START spins continuously, STOP selects where it lands, toggle between 33/45 RPM</p>
                  </div>
                </div>
                <div className="help-modal-item">
                  <div className="help-modal-icon">&#9835;</div>
                  <div className="help-modal-text">
                    <h3>Filter by Genre</h3>
                    <p>Narrow down your collection by selecting genres from the filter panel</p>
                  </div>
                </div>
                <div className="help-modal-item">
                  <div className="help-modal-icon">&#8634;</div>
                  <div className="help-modal-text">
                    <h3>Change Collection</h3>
                    <p>Switch to a different Discogs username to explore another collection</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="help-overlay-annotations" onClick={() => setIsHelpOpen(false)}>
            <div className="annotation annotation-record">
              <div className="annotation-content">
                <strong>Click the Record</strong>
                <p>Spin the roulette to randomly select an album</p>
              </div>
              <div className="annotation-arrow annotation-arrow-right"></div>
            </div>

            <div className="annotation annotation-buttons">
              <div className="annotation-content">
                <strong>Playback Controls</strong>
                <p>START spins continuously, STOP selects where it lands, SPEED toggles 33/45 RPM</p>
              </div>
              <div className="annotation-arrow annotation-arrow-down"></div>
            </div>

            <div className="annotation annotation-genre">
              <div className="annotation-content">
                <strong>Filter by Genre</strong>
                <p>Narrow down your collection by selecting genres</p>
              </div>
              <div className="annotation-arrow annotation-arrow-down"></div>
            </div>

            <div className="annotation annotation-user">
              <div className="annotation-arrow annotation-arrow-left"></div>
              <div className="annotation-content">
                <strong>Change Collection</strong>
                <p>Switch to a different Discogs username</p>
              </div>
            </div>

            <div className="annotation annotation-dismiss">
              Click anywhere to dismiss
            </div>
          </div>
        )
      )}

      {availableGenres.length > 0 && (
        <div className={`genre-filter ${isFilterExpanded ? 'expanded' : 'collapsed'}`}>
          <button
            className="filter-toggle"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <span className="filter-toggle-label">
              Filter by Genre
              {selectedGenres.length > 0 && (
                <span key={selectedGenres.length} className="filter-count">{selectedGenres.length}</span>
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
          isRouletteMode={isRouletteMode}
          onRouletteComplete={handleRouletteComplete}
          shouldStop={isManualStop}
          onStopComplete={handleStopComplete}
          resetTonearm={shouldResetTonearm}
          spinSpeed={spinSpeed}
          onSpeedToggle={handleSpeedToggle}
          onStopClick={handleStopClick}
          onStartClick={handleStartClick}
          onWheelClick={handleWheelClick}
          filterTransition={isWheelTransitioning}
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
          textDistance={85}
          perpendicularText={false}
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
            <p className="album-title">{selectedAlbum.basic_information?.title || selectedAlbum.option}</p>
            {isLoadingDetails ? (
              <div className="loading-image">Loading album details...</div>
            ) : (
              <>
                {selectedAlbumDetails?.images && selectedAlbumDetails.images.length > 0 && (
                  <div className="album-image-container">
                    <div className="vinyl-disc"></div>
                    <img
                      src={selectedAlbumDetails.images[0].resource_url}
                      alt={selectedAlbum.basic_information?.title}
                      className="album-image"
                    />
                  </div>
                )}

                {selectedAlbumDetails?.genres && selectedAlbumDetails.genres.length > 0 && (
                  <div className="album-genres">
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

                {selectedAlbumDetails?.tracklist && selectedAlbumDetails.tracklist.length > 0 && (() => {
                  // Split tracks by side (A/B/C/D etc.)
                  const getSide = (position: string) => {
                    if (!position) return '';
                    const match = position.match(/^([A-Za-z]+)/);
                    return match ? match[1].toUpperCase() : '';
                  };

                  const sides = [...new Set(selectedAlbumDetails.tracklist.map(t => getSide(t.position || '')).filter(Boolean))];
                  const hasSides = sides.length >= 2;

                  if (hasSides) {
                    // Group tracks by side
                    const tracksBySide: { [key: string]: typeof selectedAlbumDetails.tracklist } = {};
                    selectedAlbumDetails.tracklist.forEach(track => {
                      const side = getSide(track.position || '') || 'Other';
                      if (!tracksBySide[side]) tracksBySide[side] = [];
                      tracksBySide[side].push(track);
                    });

                    const sideKeys = Object.keys(tracksBySide).sort();
                    const leftSides = sideKeys.filter((_, i) => i % 2 === 0);
                    const rightSides = sideKeys.filter((_, i) => i % 2 === 1);

                    return (
                      <div className="album-tracklist">
                        <h3>Tracklist</h3>
                        <div className="track-list-sides">
                          <div className="track-side">
                            {leftSides.map(side => (
                              <div key={side} className="side-group">
                                <span className="side-label">Side {side}</span>
                                <ul className="track-list-single">
                                  {tracksBySide[side].map((track, index) => (
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
                            ))}
                          </div>
                          <div className="track-side">
                            {rightSides.map(side => (
                              <div key={side} className="side-group">
                                <span className="side-label">Side {side}</span>
                                <ul className="track-list-single">
                                  {tracksBySide[side].map((track, index) => (
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
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // No sides detected - use single column
                  return (
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
                  );
                })()}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Collection Modal */}
      <Modal isOpen={isCollectionModalOpen} onClose={() => {
        setIsCollectionModalOpen(false);
        setCollectionSearchQuery('');
      }}>
        <div className="collection-modal">
          <h2>Your Collection</h2>
          <div className="collection-search">
            <input
              type="text"
              placeholder="Search albums or artists..."
              value={collectionSearchQuery}
              onChange={(e) => setCollectionSearchQuery(e.target.value)}
              className="collection-search-input"
              autoFocus
            />
            {collectionSearchQuery && (
              <button
                className="collection-search-clear"
                onClick={() => setCollectionSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <p className="collection-modal-subtitle">
            {(() => {
              const baseData = selectedGenres.length > 0 ? filteredData : data;
              const searchFiltered = collectionSearchQuery
                ? baseData.filter(album => {
                    const query = collectionSearchQuery.toLowerCase();
                    const title = (album.basic_information?.title || album.option || '').toLowerCase();
                    const artist = (album.basic_information?.artists?.[0]?.name || '').toLowerCase();
                    return title.includes(query) || artist.includes(query);
                  })
                : baseData;
              return `${searchFiltered.length} of ${data.length} albums`;
            })()}
          </p>
          <div className="collection-list">
            {(() => {
              const baseData = selectedGenres.length > 0 ? filteredData : data;
              const searchFiltered = collectionSearchQuery
                ? baseData.filter(album => {
                    const query = collectionSearchQuery.toLowerCase();
                    const title = (album.basic_information?.title || album.option || '').toLowerCase();
                    const artist = (album.basic_information?.artists?.[0]?.name || '').toLowerCase();
                    return title.includes(query) || artist.includes(query);
                  })
                : baseData;
              return searchFiltered;
            })().map((album, index) => (
              <div
                key={album.id || index}
                className="collection-item"
                onClick={() => {
                  setSelectedAlbum(album);
                  setIsCollectionModalOpen(false);
                  setIsModalOpen(true);
                  // Fetch album details
                  if (album.id) {
                    setIsLoadingDetails(true);
                    fetchReleaseDetails(album.id)
                      .then(details => {
                        setSelectedAlbumDetails(details);
                        setIsLoadingDetails(false);
                      })
                      .catch(() => {
                        setIsLoadingDetails(false);
                      });
                  }
                }}
              >
                {album.basic_information?.thumb && (
                  <img
                    src={album.basic_information.thumb}
                    alt={album.basic_information?.title || album.option}
                    className="collection-item-thumb"
                  />
                )}
                <div className="collection-item-info">
                  <span className="collection-item-title">
                    {album.basic_information?.title || album.option}
                  </span>
                  {album.basic_information?.artists?.[0]?.name && (
                    <span className="collection-item-artist">
                      {album.basic_information.artists[0].name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DiscogsRoulette;
