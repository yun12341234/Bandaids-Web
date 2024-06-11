document.addEventListener('DOMContentLoaded', () => {
    fetch('/fetch-tracks')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Data fetched:', data);  // Add this line
            displayTracks(data);
        })
        .catch(error => console.error('Error fetching tracks:', error));
});

function displayTracks(data) {
    const tracksContainer = document.getElementById('tracks');
    tracksContainer.innerHTML = '';

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

                trackDiv.appendChild(trackName);
                trackDiv.appendChild(trackLink);
                clusterDiv.appendChild(trackDiv);
            });
        }

        tracksContainer.appendChild(clusterDiv);
    });
}
