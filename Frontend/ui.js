function initializeExpandCollapse(item) {
    const expandButton = item.querySelector('.expand');
    expandButton.addEventListener('click', function () {
      const details = this.parentElement;
      details.classList.toggle('expanded');
      if (details.classList.contains('expanded')) {
        this.innerHTML = '&#9650;';
      } else {
        this.innerHTML = '&#9660;';
      }
    });
  }

  function initializeDragAndDropItem(item) {
    item.addEventListener("dragstart", () => {
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
  }

  // Function to open the modal
  function openModal() {
    document.getElementById('myModal').style.display = "block";
  }

  // Function to close the modal
  function closeModal() {
    document.getElementById('myModal').style.display = "none";
    // Re-initialize the event listeners for drag and drop after the modal is closed
    initializeDragAndDrop();
  }

  // Function to add the Spotify song to the list by searching
  async function addToList() {
    const query = document.getElementById('spotifyLink').value.trim();
    if (query !== '') {
      try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        const track = data.tracks.items[0];
        if (track) {
          const sortableList = document.querySelector(".sortable-list");
          const newItem = document.createElement('li');
          newItem.className = "item";
          newItem.draggable = true;

          // Set the track ID as a data attribute
          newItem.setAttribute('data-track-id', track.id);

          newItem.innerHTML = `
            <div class="details">
              <img src="${track.album.images[0].url}" alt="${track.name}">
              <div>
                <div>${track.name} - ${track.artists[0].name}</div>
                <div class="song-length">🕒 ${formatDuration(track.duration_ms)}</div>
              </div>
              <button class="play-button" onclick="playSong('${track.uri}')">&#9654;</button>
              <button class="remove-button" onclick="removeFromList(this.parentNode.parentNode)">❌</button>
              <div class="expand">&#9660;</div>
              <div class="expanded-content">
                <label for="transpose">Transpose:</label>
                <input type="number" id="transpose" value="0">
                <label for="speed">Speed:</label>
                <input type="number" id="speed" value="0">
                <label for="key">Key:</label>
                <input type="number" id="key" value="0">
              </div>
            </div>
          `;
          sortableList.appendChild(newItem);
          closeModal();

          // Reinitialize drag and drop event listeners after adding a new item
          initializeDragAndDrop();

          // Initialize expand/collapse event listener for the new item
          initializeExpandCollapse(newItem);
        } else {
          alert('No matching Spotify song found.');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('An error occurred while fetching Spotify data. Please try again later.');
      }
    } else {
      alert('Please enter a search query.');
    }
  }

  function removeFromList(item) {
    item.parentNode.removeChild(item);
  }

    // Function to format duration from milliseconds to a human-readable format (minutes:seconds)
    function formatDuration(milliseconds) {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
      return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
    }