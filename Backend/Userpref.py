import json
import pandas as pd
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from sklearn.cluster import MiniBatchKMeans
import matplotlib.pyplot as plt
import numpy as np
from sklearn.cluster import KMeans
spotify = spotipy.Spotify(auth_manager=SpotifyOAuth(
    client_id="b42c8d194cce4846bbee040967fd8b5d",
    client_secret="1d936cfb130d4799981e1f68d622adca",
    redirect_uri="http://localhost:5000/callback",
    scope="user-read-recently-played"
))

user = '31pft7gctjmdmglv3fkrk4twsasa'
chosen_playlist = '3ipkeROwD3eU5z3zQkekSo'

# Fetch tracks from the chosen playlist
tracklist = []
offset = 0
limit = 100

while True:
    tracks = spotify.user_playlist_tracks(user, chosen_playlist, limit=limit, offset=offset)
    tracklist.extend(tracks['items'])
    if not tracks['next']:
        break
    offset += limit

# Ensure at least 500 tracks by adding popular tracks if needed
if len(tracklist) < 500:
    additional_tracks_needed = max(500 - len(tracklist), 0)
    top_hits_playlists = spotify.search(q="Today's Top Hits", type='playlist')['playlists']['items']
    if top_hits_playlists:
        top_hits_playlist_id = top_hits_playlists[0]['id']
    else:
        print("Error: 'Today's Top Hits' playlist not found.")
        top_hits_playlist_id = '37i9dQZF1DXcBWIGoYBM5M'
    popular_tracks = spotify.playlist_tracks(top_hits_playlist_id)['items'][:additional_tracks_needed]
    tracklist.extend(popular_tracks)

# Prepare DataFrame for tracks
data = pd.DataFrame(tracklist)

# Extract audio features
audio_features_names = []
audio_features_ids = []
audio_features_artists = []

for track_info in tracklist:
    info = track_info['track']
    audio_features_names.append(info['name'])
    audio_features_ids.append(info['id'])
    audio_features_artists.append(info['artists'][0]['name'])

# Fetch audio features in batches of 50
audio_feature_batches = [audio_features_ids[i:i+50] for i in range(0, len(audio_features_ids), 50)]
audio_features = []

for batch in audio_feature_batches:
    audio_features.extend(spotify.audio_features(batch))

# Create DataFrame for audio features
audio_features_df = pd.DataFrame(audio_features)

# Define features to use for clustering
features = ['danceability', 'energy', 'speechiness', 'acousticness', 'instrumentalness', 'valence']

# Fit KMeans model
X = audio_features_df[features]
model = KMeans(n_clusters=3)
model.fit(X)
cluster_labels = model.predict(X)

# Map songs to clusters
song_cluster_mapping = {}
for song_name, cluster_label in zip(audio_features_df.index, cluster_labels):
    if cluster_label not in song_cluster_mapping:
        song_cluster_mapping[cluster_label] = []
    song_cluster_mapping[cluster_label].append(song_name)

# Calculate mean values for each cluster
audio_features_df['clusters'] = cluster_labels
mean_cluster_values = []

clusters = [0, 1, 2]
for cluster in clusters:
    cluster_mean = audio_features_df.loc[audio_features_df['clusters'] == cluster, features].mean()
    mean_cluster_values.append(cluster_mean)

mean_df = pd.DataFrame(mean_cluster_values, columns=features)
mean_df.index = ['Cluster ' + str(cluster) for cluster in clusters]

# Function to construct query for recommendations
def construct_query(cluster_mean):
    query = ""
    for feature, value in cluster_mean.items():
        rounded_value = round(value, 2)
        query += f"{feature}:{rounded_value} "
    return query.strip()

# Function to get recently played tracks
def get_recently_played_tracks(limit=2):
    results = spotify.current_user_recently_played(limit=limit)
    track_ids = [track['track']['id'] for track in results['items']]
    return track_ids

# Function to search for tracks based on cluster mean values
def search_tracks(cluster_mean, limit=3, exclude_artists=set()):
    seed_tracks = get_recently_played_tracks(limit=2)
    query = construct_query(cluster_mean)
    
    if seed_tracks:
        results = spotify.recommendations(seed_tracks=seed_tracks, limit=limit, **cluster_mean.to_dict())
    else:
        results = spotify.recommendations(limit=limit, **cluster_mean.to_dict())
    
    tracks = []
    for track in results['tracks']:
        artist_name = track['artists'][0]['name']
        if artist_name not in exclude_artists:
            tracks.append({
                'name': track['name'],
                'artist': artist_name,
                'spotify_url': track['external_urls']['spotify']
            })
            exclude_artists.add(artist_name)
    return tracks

output = {}
for cluster_label, cluster_mean in mean_df.iterrows():
    output[f"Cluster {cluster_label}"] = []
    try:
        recommended_songs = search_tracks(cluster_mean, limit=3)
        output[f"Cluster {cluster_label}"] = recommended_songs
    except Exception as e:
        output[f"Cluster {cluster_label}"] = {'error': str(e)}
    
print(json.dumps(output))