from flask import Flask, request, jsonify, make_response
from flask_cors import CORS # allow requests from your frontend
import pandas as pd #read CSV from dataset
import matplotlib.pyplot as plt #plotting
import seaborn as sns #data visualization
import numpy as np
import tekore as tk # interact with API
import csv

from sklearn.metrics.pairwise import cosine_similarity #for calculating cosine similarity
from sklearn.cluster import KMeans

app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

client_id = 'ee682c24fd394f3486d371d2d2f7ad48'
client_secret = 'a41a7c94a65946b285e899739e86f68b'

app_token = tk.request_client_token(client_id, client_secret)
spotify = tk.Spotify(app_token)

datasetPath = 'datasetGenre1.csv'

def loadDataset():
    return pd.read_csv(datasetPath)

dataset = loadDataset()

df_cluster = dataset.copy()
X = df_cluster[['acousticness', 'energy', 'valence']].values

# Attributes
acous = dataset['acousticness']
energ = dataset['energy']
val = dataset['valence']

# Combine the data into list of tuples
data = list(zip(acous, energ, val))

kmeans = KMeans(n_clusters=6, n_init=10) #initialize kmeans clustering model with 6 clusters & 10 initializations
kmeans.fit(data) #perform clustering based on "data"

labels = kmeans.labels_ # retrieve cluster labels

# Create a new figure and axis for scatter plot
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')

# Scatter plot each point, colored by cluster label (dont need)
for label in set(labels):
    ax.scatter(acous[labels == label], energ[labels == label], val[labels == label], label=f'Cluster {label}')

ax.set_xlabel('Acousticness')
ax.set_ylabel('Energy')
ax.set_zlabel('Valence')
plt.legend()

# Recommend songs function
def recommend(chosenSongIndex, start=0, batch_size=10, includeChosenSong=True):
    # Retrieve the name, ID, and genre of the chosen song and feature values
    chosenSongName = dataset['track_name'][chosenSongIndex]
    chosenSongID = dataset['track_id'][chosenSongIndex]
    chosenSongGenre = dataset['genre'][chosenSongIndex].split('; ')
    chosenSongFeatures = dataset[['acousticness', 'energy', 'valence']].iloc[chosenSongIndex].values.reshape(1, -1)

    # Determine the number of common genres required
    if 'hard rock' in chosenSongGenre:
        required_genre_overlap = 2
    elif 'rock' in chosenSongGenre:
        required_genre_overlap = 2
    elif 'rap' in chosenSongGenre:
        required_genre_overlap = 2
    else:
        required_genre_overlap = 1

    # Tokenize the genres into individual words
    chosenSongGenreWords = set(word.lower() for genre in chosenSongGenre for word in genre.split())
    contains_pop = 'pop' in chosenSongGenreWords
    contains_indie = 'indie' in chosenSongGenreWords

    # Predict the cluster for the chosen song
    predictedCluster = kmeans.predict(chosenSongFeatures)

    # Extracting songs from the predicted cluster including the index
    songsInCluster = [(i, dataset['track_name'][i], dataset['track_id'][i], dataset['artist_name'][i], dataset['genre'][i].split('; '), dataset[['acousticness', 'energy', 'valence']].iloc[i].values.reshape(1, -1))
                      for i, label in enumerate(labels) if label == predictedCluster[0] and i != chosenSongIndex]

    # Calculate cosine similarity between the chosen song and other songs in the same cluster that share the required number of genres
    similarities = []
    added_songs = set()

    for index, name, track_id, artist, genres, features in songsInCluster:
        genresWords = set(word.lower() for genre in genres for word in genre.split())
        if (len(chosenSongGenreWords.intersection(genresWords)) >= required_genre_overlap or 
            (contains_pop and 'pop' in genresWords) or 
            (contains_indie and 'indie' in genresWords)):
            similarity = cosine_similarity(chosenSongFeatures, features)
            checkDupe = (name, artist)
            if checkDupe not in added_songs:
                similarities.append((name, track_id, similarity[0][0]))
                added_songs.add(checkDupe)

    # Sort songs by similarity: from most similar to least
    similarities.sort(key=lambda x: x[2], reverse=True)

    # Optionally include the chosen song at the top
    if includeChosenSong and chosenSongID not in added_songs:
        similarities.insert(0, (chosenSongName, chosenSongID, 1.0))  # Ensure the chosen song is included at the top

    # Return the specified batch of similarities
    end = start + batch_size
    print(similarities[start:end])
    return similarities[start:end]


@app.route('/handleClick', methods=['POST'])
def handle_click():
    global dataset, labels, kmeans

    data = request.get_json()
    track_id = data.get('trackId')
    start = data.get('start', 0)  # default to 0 if not provided
    batch_size = data.get('batch_size', 10)  # default to 10 if not provided

    print('Received track ID:', track_id)
    track_info = spotify.track(track_id)
    found = False
    for index, row in dataset.iterrows():
        if row['track_id'] == track_id:
            found = True
            dataset_index = index
            recommendations = recommend(dataset_index, start=start, batch_size=batch_size)
            break
    if not found:
        audio_features = spotify.track_audio_features(track_id)
        track_name = track_info.name
        artists = track_info.artists
        artist_name = artists[0].name if artists else 'Unknown'
        artist_details = spotify.artist(artists[0].id) if artists else None
        genres = artist_details.genres if artist_details and artist_details.genres else ['Unknown']
        genre_list = '; '.join(genres)
        next_index = len(dataset)
        row = [
            next_index,
            artist_name,
            track_name,
            track_id,
            genre_list,
            audio_features.danceability,
            audio_features.energy,
            audio_features.key,
            audio_features.loudness,
            audio_features.mode,
            audio_features.speechiness,
            audio_features.acousticness,
            audio_features.instrumentalness,
            audio_features.liveness,
            audio_features.valence,
            audio_features.tempo
        ]
        with open(datasetPath, 'a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(row)
        dataset = loadDataset()  # reload the dataset after writing to the CSV
        # Re-fit kmeans with the updated dataset
        df_cluster = dataset.copy()
        X = df_cluster[['acousticness', 'energy', 'valence']].values
        kmeans = KMeans(n_clusters=6, n_init=10)
        kmeans.fit(X)
        labels = kmeans.labels_

        recommendations = recommend(next_index, start=start, batch_size=batch_size)
    return jsonify({
        "trackInfo": {
            "name": track_info.name,
            "id": track_info.id
        },
        "recommendations": [
            {"name": rec[0], "id": rec[1], "similarity": rec[2]}
            for rec in recommendations
        ]
    })


# run on port 5000
if __name__ == '__main__':
    app.run(debug=True, port=5000)
