let token;

async function getTokenAndPopulateList() {
  try {
    while (!token) {
      const response = await fetch('/getToken');
      token = await response.text();
      if (!token) {
        await delay(3000); // Wait for 3 seconds before trying again
      }
    }
    
    // Now that the token is retrieved successfully, proceed with populating the list
    
    alert("Your token is: " + token);
  } catch (error) {
    console.error('Error fetching token:', error);
    alert('An error occurred while fetching token.');
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}





  // Function to fetch track details from Spotify using track ID
  async function fetchTrackDetails(trackId) {
    try {
      const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch track details');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching track details:', error);
      throw error; // Propagate the error for handling
    }
  }

  async function populateListFromDatabase() {
    try {
      const response = await fetch('/getData');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      const sortableList = document.querySelector(".sortable-list");
      sortableList.innerHTML = ""; // Clear existing list items
      for (const itemData of data) {
        console.log("Item data:", itemData); // Log item data to check if trackId is present
        // Fetch track details using trackId
        const trackDetails = await fetchTrackDetails(itemData.trackId);

        console.log("Track details:", trackDetails); // Log track details to ensure they are fetched correctly
        const newItem = document.createElement('li');
        newItem.className = "item";
        newItem.draggable = true;
        newItem.setAttribute('data-track-id', itemData.trackId);
        // Include trackId in the list item's HTML markup
        newItem.innerHTML = `
          <div class="details" data-track-id="${itemData.trackId}">
            <img src="${trackDetails.album.images[0].url}" alt="${trackDetails.name}">
            <div>
              <div>${trackDetails.name} - ${trackDetails.artists[0].name}</div>
              <div class="song-length">🕒 ${formatDuration(trackDetails.duration_ms)}</div>
            </div>
            <button class="play-button" onclick="playSong('${trackDetails.uri}')">&#9654;</button>
            <button class="remove-button" onclick="removeFromList(this.parentNode.parentNode)">❌</button>
            <div class="expand">&#9660;</div>
            <div class="expanded-content">
              <label for="transpose">Transpose:</label>
              <input type="number" id="transpose" value="${itemData.transpose}">
              <label for="speed">Speed:</label>
              <input type="number" id="speed" value="${itemData.speed}">
              <label for="key">Key:</label>
              <input type="number" id="key" value="${itemData.key}">
            </div>
          </div>
        `;
        sortableList.appendChild(newItem);

        // Initialize drag and drop event listeners for the new item
        initializeDragAndDropItem(newItem);

        // Initialize expand/collapse event listener for the new item
        initializeExpandCollapse(newItem);
      }
    } catch (error) {
      console.error('Error populating list from database:', error);
      alert('An error occurred while populating list from the database. Please try again later.');
    }
  }

  // Function to format duration from milliseconds to a human-readable format (minutes:seconds)
  function formatDuration(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  }

  getTokenAndPopulateList();
  populateListFromDatabase();