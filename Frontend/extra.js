async function fetchTrackDetails(trackId, token, retries = 3, delay = 1000) {
    try {
      const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch track details');
      }
      return await response.json();
    } catch (error) {
      if (retries > 0) {
        console.warn(`Retrying fetch for track ${trackId} (${retries} retries left)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchTrackDetails(trackId, token, retries - 1, delay);
      } else {
        console.error('Error fetching track details:', error);
        throw error;
      }
    }
}
  
  async function populateListFromDatabase() {
    try {
      const response = await fetch('/getData');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      const sortableList = document.querySelector(".sortable-list1");
      sortableList.innerHTML = ""; // Clear existing list items
      for (const itemData of data) {
        console.log("Item data:", itemData); // Log item data to check if trackId is present
        try {
          // Fetch track details using trackId
          const trackDetails = await fetchTrackDetails(itemData.trackId, token);
          console.log("Track details:", trackDetails); // Log track details to ensure they are fetched correctly
          const newItem = document.createElement('li');
          newItem.className = "item";
          newItem.setAttribute('data-track-id', itemData.trackId);
          // Include trackId in the list item's HTML markup
          newItem.innerHTML = `
          <div class="details" data-track-id="${itemData.trackId}">
            <img src="${trackDetails.album.images[0].url}" alt="${trackDetails.name}">
          <div>
            <div>${trackDetails.name} - ${trackDetails.artists[0].name}</div>
            <div class="song-length">🕒 ${formatTime(trackDetails.duration_ms)}</div>
          </div>
          <button class="play-button" onclick="playSong('${trackDetails.uri}')">&#9654;</button>
          <button class="stop-button" onclick="stopSong()">⬛</button>
          <button class="remove-button" onclick="removeFromList(this.parentNode.parentNode)">❌</button>
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
  