export interface DatabaseRubrique {
  id_rubric: number;
  rubric_name: string;
  campaign_countries_languages_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseSerie {
  serie_id: number;
  title: string;
  description?: string;
  url_covers?: string;
  campaign_countries_languages_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseSerieRubrique {
  serie_id: number;
  id_rubric: number;
  campaign_countries_languages_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseEpisode {
  series_id: number;
  episode_id: number;
  season_id: number;
  episode_position: number;
  season_position?: number;
  title?: string;
  description?: string;
  duration?: number;
  product_year?: number;
  url_streaming_no_drm?: string;
  campaign_countries_languages_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseFreeEpisode {
  episode_id: number;
  campaign_countries_languages_id: string;
  created_at?: string;
  updated_at?: string;
}