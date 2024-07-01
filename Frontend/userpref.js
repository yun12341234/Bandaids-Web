document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('userPreferencesForm');
    const loadingMessage = document.getElementById('loadingMessage');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        // Show loading indicator
        document.body.classList.add('loading');
        loadingMessage.style.display = 'block';

        try {
            await saveUserPreferences(); // Wait for saveUserPreferences to complete

            const response = await fetch('/fetch-tracks');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Data fetched:', data);

            await saveTracksToDatabase(data); // Save tracks to the database
            await populateListFromDatabase();
            await deleteOldDataUserpref(); // Clear the database before populating the list

        } catch (error) {
            console.error('Error fetching tracks:', error);
        } finally {
            // Hide loading indicator
            document.body.classList.remove('loading');
            loadingMessage.style.display = 'none';
        }
    });
});

let token;
let currentTrackId = null;
let currentStartIndex = 0;
let currentAudio;

async function saveUserPreferences() {
    try {
        const spotifyPlaylist = document.getElementById('spotify_playlist').value;
        const ageValue = document.getElementById('age').value;
        const age = parseInt(ageValue, 10);

        const response = await fetch('/process-user-preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ spotifyPlaylist, age }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Data processed successfully:', data);
    } catch (error) {
        console.error('Error processing user preferences:', error);
        throw error;
    }
}

async function saveTracksToDatabase(data) {
    let tracksToSave = [];

    Object.keys(data).forEach(clusterLabel => {
        const clusterData = data[clusterLabel];

        if (!clusterData.error) {
            clusterData.forEach(track => {
                tracksToSave.push({
                    trackId: track.track_id,
                    spotifyLink: track.spotify_url,
                    start: 0,
                    end: 0,
                    speed: 100,
                    key: 0
                });
            });
        }
    });

    console.log('Tracks to save:', tracksToSave); // Debugging log to verify data structure

    await fetch('/saveDataUserpref', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songs: tracksToSave }), // Note that songs are sent within an object
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Songs added to database successfully:', data);
        alert('Songs saved successfully!');
    })
    .catch(error => {
        console.error('Error adding songs to database:', error);
        alert('An error occurred while adding songs to the database. Please try again later.');
    });
}

async function deleteOldDataUserpref() {
    try {
        const response = await fetch('/deleteOldDataUserpref', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error('Failed to delete old data');
        }
        const data = await response.text();
        console.log('Old data deleted successfully:', data);
    } catch (error) {
        console.error('Error deleting old data:', error);
        alert('An error occurred while deleting old data. Please try again later.');
    }
}

async function fetchTrackDetails(trackId, token) {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch track details for trackId: ${trackId}`);
    }
    return response.json();
}

async function fetchToken() {
    try {
        const response = await fetch('/getToken');
        if (!response.ok) {
            throw new Error('Failed to fetch token');
        }
        const token = await response.text();
        return token;
    } catch (error) {
        console.error('Error fetching token:', error);
        throw error;
    }
}

async function populateListFromDatabase() {
    try {
        token = await fetchToken(); // Get the Spotify token and assign to global variable
        const response = await fetch('/getDataUserpref');
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        const sortableList = document.querySelector(".sortable-list1");
        if (!sortableList) {
            throw new Error('Element with class sortable-list1 not found');
        }
        sortableList.innerHTML = ""; // Clear existing list items
        for (const itemData of data) {
            console.log("Item data:", itemData); // Log item data to check if trackId is present
            try {
                // Fetch track details using trackId
                const trackDetails = await fetchTrackDetails(itemData.trackId, token);
                console.log("Track details:", trackDetails);
                const newItem = document.createElement('li');
                newItem.className = "item";
                newItem.setAttribute('data-track-id', itemData.trackId);
                // Include trackId in the list item's HTML markup
                newItem.innerHTML = `
                <div class="details" data-track-id="${itemData.trackId}">
                    <div>
                        <div>${trackDetails.name} - ${trackDetails.artists[0].name}</div>
                        <div class="song-length">🕒 ${formatTime(trackDetails.duration_ms)}</div>
                    </div>
                    <div class="songButton">
                        <button class="play-button" onclick="playSong('${trackDetails.uri}', 100)">&#9654;</button> <!-- Added default speed value -->
                        <button class="stop-button" onclick="stopSong()">⬛</button>
                        <button class="remove-button" onclick="removeFromList(this.parentNode.parentNode)">❌</button>
                        <button class="addTrack-button" onclick="saveToTracklistDB('${trackDetails.uri}', '${itemData.trackId}')">➕</button>
                    </div>
                </div>
                `;
                sortableList.appendChild(newItem);
            } catch (error) {
                console.error(`Error fetching details for track ${itemData.trackId}:`, error);
            }
        }
    } catch (error) {
        console.error('Error populating list from database:', error);
        alert('An error occurred while populating the list from the database. Please try again later.');
    }
}


function formatTime(duration_ms) {
    const minutes = Math.floor(duration_ms / 60000);
    const seconds = ((duration_ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function playSong(trackUri, speed) {
    if (!trackUri) {
        alert('No track URI available.');
        return;
    }

    console.log('Playing song with URI:', trackUri); // Log the track URI to verify it

    try {
        // Fetch track details from Spotify API using the track URI
        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackUri.split('spotify:track:')[1]}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch track details');
        }

        const trackData = await response.json();
        const previewUrl = trackData.preview_url;
        if (!previewUrl) {
            throw new Error('No preview available for this track');
        }

        // Stop the current audio if it's playing
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        // Ensure that the speed value is a valid number and within acceptable range
        if (!isNaN(speed) && isFinite(speed) && speed > 0) {
            // Create a new audio element to play the preview
            currentAudio = new Audio(previewUrl);
            currentAudio.playbackRate = speed / 100; // Set the playback rate based on the provided speed
            currentAudio.play();

            console.log('Playing preview for track:', trackData.name);
        } else {
            console.log(speed);
            // If the speed value is not valid, play the song with the default speed (1)
            currentAudio = new Audio(previewUrl);
            currentAudio.play();
            console.log('Playing preview for track:', trackData.name, 'with default speed');
        }
    } catch (error) {
        console.error('Error playing song:', error);
        alert('An error occurred while playing the song. Please try again later.');
    }
}


function stopSong() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
}

function removeFromList(item) {
    // Pause the audio if it's currently playing
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    item.parentNode.removeChild(item);
}

function saveToTracklistDB(uri, name, artist, imageUrl, trackId) {
    // Implement save to tracklist database functionality
}

function getAudioDuration(file) {
    return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
            resolve(audio.duration);
        };
        audio.onerror = (error) => {
            reject(error);
        };
    });
}

async function saveToTracklistDB(uri, trackId) {
    const trackData = {
        trackId: trackId,
        spotifyLink: uri,
        start: 0,
        end: 0,
        speed: 100,
        key: 0
    };

    try {
        const response = await fetch('/saveData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([trackData]) // Save data as an array
        });

        if (!response.ok) {
            throw new Error('Failed to save track data');
        }

        const result = await response.json();
        console.log('Track data saved successfully:', result);
    } catch (error) {
        console.error('Error saving track data:', error);
        alert('An error occurred while saving the track data. Please try again later.');
    }
}
