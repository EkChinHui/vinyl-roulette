import axios from 'axios';

declare global {
  interface Window {
    _env_: {
      VITE_DISCOGS_USERNAME: string;
    };
  }
}

const DISCOGS_API_URL = 'https://api.discogs.com';

const getEnvUsername = () => {
  // return window._env_?.VITE_DISCOGS_USERNAME || import.meta.env.VITE_DISCOGS_USERNAME;
  return undefined;
};

interface BasicInformation {
  title: string;
  artists: Array<{ name: string }>;
  year: number;
  cover_image?: string;
  genres?: string[];
  styles?: string[];
}

interface ReleaseImage {
  type: string;
  uri: string;
  resource_url: string;
  uri150: string;
  width: number;
  height: number;
}

export interface Track {
  position: string;
  title: string;
  duration: string;
  
}

export interface ReleaseDetails {
  id: number;
  title: string;
  artists: Array<{ name: string }>;
  year: number;
  images: ReleaseImage[];
  tracklist: Track[];
  genres: string[];
  styles?: string[];
}

export interface RouletteData {
  id: number;
  option: string;
  imageUrl?: string;
  basic_information: BasicInformation;
}

export const fetchReleaseDetails = async (releaseId: number): Promise<ReleaseDetails> => {
  try {
    const response = await axios.get(
      `${DISCOGS_API_URL}/releases/${releaseId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching release details:', error);
    throw error;
  }
};

export const fetchCollection = async (username?: string): Promise<RouletteData[]> => {
  const targetUsername = username || getEnvUsername();

  if (!targetUsername) {
    throw new Error('Discogs username not configured!');
  }

  try {
    const response = await axios.get(
      `${DISCOGS_API_URL}/users/${targetUsername}/collection/folders/0/releases`
    );

    return response.data.releases.map((release: any) => ({
      id: release.id,
      option: `${release.basic_information.artists[0].name} - ${release.basic_information.title} (${release.basic_information.year})`,
      imageUrl: release.basic_information.cover_image,
      basic_information: release.basic_information,
    }));
  } catch (error) {
    console.error('Error fetching collection:', error);
    throw error;
  }
};
