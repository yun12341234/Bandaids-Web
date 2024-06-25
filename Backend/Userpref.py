import json
import os
import pandas as pd
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from sklearn.preprocessing import StandardScaler
from sklearn.mixture import GaussianMixture
import sys
import random

# Replace these values with your Spotify credentials
SPOTIPY_CLIENT_ID = 'b42c8d194cce4846bbee040967fd8b5d'
SPOTIPY_CLIENT_SECRET = '1d936cfb130d4799981e1f68d622adca'
SPOTIPY_REDIRECT_URI = 'http://localhost:3000/'

chosen_playlist = sys.argv[1]
age = sys.argv[2]
age = int(age)



spotify = spotipy.Spotify(auth_manager=SpotifyOAuth(
    client_id=SPOTIPY_CLIENT_ID,
    client_secret=SPOTIPY_CLIENT_SECRET,
    redirect_uri=SPOTIPY_REDIRECT_URI,
    scope='user-read-recently-played'
))

user = spotify.current_user()['id']
tracklist = []
offset = 0
limit = 100

while True:
    tracks = spotify.user_playlist_tracks(user, chosen_playlist, limit=limit, offset=offset)
    tracklist.extend(tracks['items'])
    if not tracks['next']:
        break
    offset += limit

if len(tracklist) < 500:
    additional_tracks_needed = max(500 - len(tracklist), 0)
    recently_played_limit = 50
    recently_played_offset = 0

    while additional_tracks_needed > 0:
        fetch_limit = min(recently_played_limit, additional_tracks_needed)
        recently_played_tracks = spotify.current_user_recently_played(limit=fetch_limit, after=recently_played_offset)['items']
        tracklist.extend(recently_played_tracks)
        additional_tracks_needed -= len(recently_played_tracks)
        if len(recently_played_tracks) < fetch_limit:
            break
        recently_played_offset = recently_played_tracks[-1]['played_at']

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
features = ['danceability', 'energy', 'speechiness', 'acousticness', 'instrumentalness', 'valence', 'tempo']

# Normalize features
scaler = StandardScaler()
X = scaler.fit_transform(audio_features_df[features])

# Function to find optimal number of clusters using Elbow Method
def find_optimal_clusters_elbow(data, max_clusters=6):
    n_clusters = range(1, max_clusters + 1)
    gmm_models = [GaussianMixture(n, random_state=42).fit(data) for n in n_clusters]
    bics = [model.bic(data) for model in gmm_models]

    optimal_clusters = n_clusters[bics.index(min(bics))]
    return optimal_clusters

# Find optimal number of clusters
optimal_clusters = find_optimal_clusters_elbow(X)

# Fit GMM model with optimal number of clusters
model = GaussianMixture(n_components=optimal_clusters, random_state=42)
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

clusters = range(model.n_components)
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

def get_seed_songs_from_clusters(cluster_labels, tracklist, num_seeds=5):
    cluster_tracks = {i: [] for i in range(len(set(cluster_labels)))}

    for track_info, label in zip(tracklist, cluster_labels):
        cluster_tracks[label].append(track_info['track']['id'])

    seed_tracks = []
    for label, tracks in cluster_tracks.items():
        if tracks:
            seed_tracks.extend(random.sample(tracks, min(num_seeds, len(tracks))))

    return seed_tracks[:num_seeds]

def get_recently_played_tracks(limit=5):
    results = spotify.current_user_recently_played(limit=limit)
    return [track['track']['id'] for track in results['items']]

def search_tracks(cluster_mean, age, cluster_seed_tracks, limit=3, exclude_artists=set(), weight=0.7):
    # Adjust based on age groups
    genres, feature_adjustments = [], {}
    if age < 20:
        genres = ["pop", "hip hop", "electronic", "indie pop"]
        feature_adjustments = {
            "energy": 1.1,
            "danceability": 1.1
        }
    elif 20 <= age < 40:
        genres = ["pop", "rock", "hip hop", "electronic", "alternative"]
        feature_adjustments = {}
    else:
        genres = ["classic rock", "jazz", "blues", "soul", "folk"]
        feature_adjustments = {
            "acousticness": 1.1,
            "instrumentalness": 1.1,
            "energy": 0.9,
            "tempo": 0.9
        }

    # Adjust cluster mean values based on age-specific feature adjustments
    adjusted_cluster_mean = cluster_mean.copy()
    for feature, adjustment in feature_adjustments.items():
        if feature in adjusted_cluster_mean:
            adjusted_cluster_mean[feature] = (weight * adjusted_cluster_mean[feature]) + ((1 - weight) * (adjusted_cluster_mean[feature] * adjustment))

    query = construct_query(adjusted_cluster_mean)

    # Fetch recently played tracks and combine with cluster seed tracks
    recently_played_seed_tracks = get_recently_played_tracks(limit=5)
    seed_tracks = list(set(recently_played_seed_tracks + cluster_seed_tracks))[:5]

    # Fetch recommendations
    if seed_tracks:
        results = spotify.recommendations(seed_tracks=seed_tracks, limit=limit, **adjusted_cluster_mean.to_dict(), genre=genres)
    else:
        results = spotify.recommendations(limit=limit, **adjusted_cluster_mean.to_dict(), genre=genres)

    # Filter and format recommendations
    tracks = []
    for track in results['tracks']:
        artist_name = track['artists'][0]['name']
        track_id1 = track['id']
        if artist_name not in exclude_artists:
            tracks.append({
                'name': track['name'],
                'artist': artist_name,
                'spotify_url': track['external_urls']['spotify'],
                'track_id': track_id1
            })
            exclude_artists.add(artist_name)
    return tracks


output = {}
for cluster_label, cluster_mean in mean_df.iterrows():
    output[f"Cluster {cluster_label}"] = []
    try:
        # Get seed songs from the current cluster
        cluster_seed_tracks = get_seed_songs_from_clusters(cluster_labels, tracklist, num_seeds=5)
        recommended_songs = search_tracks(cluster_mean, age, cluster_seed_tracks=cluster_seed_tracks, limit=3)
        output[f"Cluster {cluster_label}"] = recommended_songs
    except Exception as e:
        output[f"Cluster {cluster_label}"] = {'error': str(e)}

print(json.dumps(output))
