document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('userPreferencesForm');
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        try {
            await saveUserPreferences(); // Wait for saveUserPreferences to complete

            const response = await fetch('/fetch-tracks');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Data fetched:', data);
            displayTracks(data);
        } catch (error) {
            console.error('Error fetching tracks:', error);
        }
    });
});

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

let selectedSongs = [];

function displayTracks(data) {
    const tracksContainer = document.getElementById('tracks');
    tracksContainer.innerHTML = '';

    const countContainer = document.createElement('div');
    countContainer.classList.add('count-container');
    const countLabel = document.createElement('p');
    countLabel.textContent = 'Songs Selected: ';
    const countSpan = document.createElement('span');
    countSpan.textContent = '0';
    countSpan.classList.add('count-span'); // Add class for custom styling
    countContainer.appendChild(countLabel);
    countContainer.appendChild(countSpan);

    const finalizeButton = document.createElement('button');
    finalizeButton.textContent = 'Finalize';
    finalizeButton.classList.add('finalize-button');
    finalizeButton.disabled = true;
    finalizeButton.addEventListener('click', () => {
        finalizeSelection();
    });

    countContainer.appendChild(finalizeButton);
    tracksContainer.appendChild(countContainer);

    Object.keys(data).forEach(clusterLabel => {
        const clusterData = data[clusterLabel];

        const clusterDiv = document.createElement('div');
        clusterDiv.classList.add('cluster');

        const clusterHeading = document.createElement('h2');
        clusterHeading.textContent = clusterLabel;
        clusterDiv.appendChild(clusterHeading);

        if (clusterData.error) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = `Error: ${clusterData.error}`;
            clusterDiv.appendChild(errorMsg);
        } else {
            clusterData.forEach(track => {
                const trackDiv = document.createElement('div');
                trackDiv.classList.add('track');

                const trackName = document.createElement('p');
                trackName.innerHTML = `<strong>${track.name}</strong> by ${track.artist}`;

                const trackLink = document.createElement('a');
                trackLink.href = track.spotify_url;
                trackLink.textContent = 'Listen on Spotify';
                trackLink.target = '_blank';

                const addButton = document.createElement('button');
                addButton.textContent = 'Add';
                addButton.classList.add('add-button');
                addButton.addEventListener('click', () => {
                    addToSelection({
                        trackId: track.track_id,
                        spotifyLink: track.spotify_url,
                        start: 0,
                        end: 0,
                        speed: 100,
                        key: 0
                    });
                    countSpan.textContent = selectedSongs.length.toString();
                    finalizeButton.disabled = selectedSongs.length === 0;
                    addButton.disabled = true; // Disable the add button after adding the song
                });

                trackDiv.appendChild(trackName);
                trackDiv.appendChild(trackLink);
                trackDiv.appendChild(addButton);
                clusterDiv.appendChild(trackDiv);
            });
        }

        tracksContainer.appendChild(clusterDiv);
    });
}

function addToSelection(track) {
    selectedSongs.push(track);
}

function finalizeSelection() {
    if (!Array.isArray(selectedSongs) || selectedSongs.length === 0) {
        alert('Please select at least one song to finalize.');
        return;
    }

    const dataToSave = selectedSongs.map(track => ({
        trackId: track.trackId,
        spotifyLink: track.spotifyLink,
        start: track.start,
        end: track.end,
        speed: track.speed,
        key: track.key
    }));

    console.log('Data to save:', dataToSave); // Debugging log to verify data structure

    fetch('/saveDataUserpref', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songs: dataToSave }), // Note that songs are sent within an object
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Songs added to database successfully:', data);
        selectedSongs = [];
        alert('Songs saved successfully!');
        window.location.href = '/'; // Redirect to home page
    })
    .catch(error => {
        console.error('Error adding songs to database:', error);
        alert('An error occurred while adding songs to the database. Please try again later.');
    });
}
