
let token;

// Function to initialize drag and drop event listeners
function initializeDragAndDrop() {
    const sortableList = document.querySelector(".sortable-list");
    const items = sortableList.querySelectorAll(".item");

    items.forEach(item => {
        item.addEventListener("dragstart", () => {
            setTimeout(() => item.classList.add("dragging"), 0);
        });
        item.addEventListener("dragend", () => item.classList.remove("dragging"));
    });

    function initSortableList(e) {
        e.preventDefault();
        const draggingItem = document.querySelector(".dragging");
        if (!draggingItem) return; // Check if draggingItem exists
        const siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];
        const nextSibling = siblings.find(sibling => {
            return e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2;
        });
        if (nextSibling) {
            sortableList.insertBefore(draggingItem, nextSibling);
        } else {
            sortableList.appendChild(draggingItem); // Append draggingItem if no next sibling found
        }
    }

    sortableList.addEventListener("dragover", initSortableList);
    sortableList.addEventListener("dragenter", e => e.preventDefault());

    // Add event listeners for expanding and collapsing
    const expandButtons = document.querySelectorAll('.expand');
    expandButtons.forEach(button => {
        button.addEventListener('click', function () {
            const details = this.parentElement;
            details.classList.toggle('expanded');
            if (details.classList.contains('expanded')) {
                this.innerHTML = '&#9650;';
            } else {
                this.innerHTML = '&#9660;';
            }
        });
    });
}

// Initialize drag and drop event listeners initially
initializeDragAndDrop();
// window.onload = function () {
//     alert("Your token is: " + token);
// };

function saveToDatabase() {
    // First, delete all existing data
    fetch('/deleteOldData', {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete old data');
            }
            // Once old data is deleted, proceed to save new data
            const items = document.querySelectorAll(".sortable-list .item");
            const dataToSave = [];

            items.forEach(item => {
                const spotifyLink = item.querySelector('img').getAttribute('src');
                const trackId = item.getAttribute('data-track-id'); // Retrieve track ID from data attribute
                const details = item.querySelector('.expanded-content');

                // Select the transpose, speed, and key input fields within the details
                const endInput = details.querySelector('#start');
                const startInput = details.querySelector('#end');
                const speedInput = details.querySelector('#speed');
                const keyInput = details.querySelector('#key');

                // Get values from the input fields, or default to "0" if the fields are null
                const start = startInput ? startInput.value : 0;
                const end = endInput ? endInput.value : 0;
                const speed = speedInput ? speedInput.value : 0;
                const key = keyInput ? keyInput.value : 0;

                // Push data to the array
                dataToSave.push({
                    spotifyLink,
                    trackId, // Include track ID in the saved data
                    start,
                    end,
                    speed,
                    key
                });
            });

            // Send new data to the server to save in the database
            return fetch('/saveData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSave)
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save data');
            }
            alert('Data saved successfully!');
        })
        .catch(error => {
            console.error('Error saving data:', error);
            alert('An error occurred while saving data. Please try again later.');
        });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Function to fetch a new token
async function fetchToken() {
    try {
        const response = await fetch('/getToken');
        if (!response.ok) {
            throw new Error('Failed to fetch token');
        }
        token = await response.text();
    } catch (error) {
        console.error('Error fetching token:', error);
        throw error;
    }
}

async function getTokenAndPopulateList() {
    try {
        await fetchToken(); // Fetch the token initially

        if (!token) {
            alert('Failed to retrieve token.');
            return;
        }

        // Now that the token is retrieved successfully, proceed with populating the list
        alert("Your token is: " + token);
        await populateListFromDatabase(); // Populate list after obtaining the token
    } catch (error) {
        console.error('Error fetching token:', error);
        alert('An error occurred while fetching token.');
    }
}

// Function to fetch track details from Spotify using track ID
async function fetchTrackDetails(trackId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.status === 401) {
            // Token might be expired, fetch a new token and retry
            await fetchToken();
            if (!token) {
                throw new Error('Failed to fetch token');
            }
            // Retry fetching track details with the new token
            return fetchTrackDetails(trackId);
        }
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


async function playSong(trackUri) {

    if (!trackUri) {
        alert('No track URI available.');
        return;
    }

    console.log('Playing song with URI:', trackUri);

    try {
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

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        currentAudio = new Audio(previewUrl);
        currentAudio.crossOrigin = "anonymous";

        console.log('Playing preview for track:', trackData.name);
    } catch (error) {
        console.error('Error playing song:', error);
        alert('An error occurred while playing the song. Please try again later.');
    }
}

const sortableList = document.querySelector(".sortable-list");
const items = sortableList.querySelectorAll(".item");

items.forEach(item => {
    item.addEventListener("dragstart", () => {
        // Adding dragging class to item after a delay
        setTimeout(() => item.classList.add("dragging"), 0);
    });
    // Removing dragging class from item on dragend event
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
});

const initSortableList = (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector(".dragging");
    // Getting all items except currently dragging and making array of them
    let siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];

    // Finding the sibling after which the dragging item should be placed
    let nextSibling = siblings.find(sibling => {
        return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
    });

    // Inserting the dragging item before the found sibling
    sortableList.insertBefore(draggingItem, nextSibling);
}

getTokenAndPopulateList();
populateListFromDatabase();

sortableList.addEventListener("dragover", initSortableList);
sortableList.addEventListener("dragenter", e => e.preventDefault());




  // const track = {
  //   name: "",
  //   album: {
  //     images: [
  //       { url: "" }
  //     ]
  //   },
  //   artists: [
  //     { name: "" }
  //   ]
  // };

  // var is_paused = false;
  // var setPaused = false;
  // var is_active = false;
  // var setActive = false;
  // var player;
  // var setPlayer;
  // var current_track = track;
  // var setTrack = track;

  // function initializeSpotifyPlayer() {
  //   window.onSpotifyWebPlaybackSDKReady = () => {
  //     const player = new Spotify.Player({
  //       name: 'Web Playback SDK Quick Start Player',
  //       getOAuthToken: cb => {
  //         cb(token);
  //       }
  //     });

  //     // Error handling
  //     player.addListener('initialization_error', ({ message }) => {
  //       console.error(message);
  //     });
  //     player.addListener('authentication_error', ({ message }) => {
  //       console.error(message);
  //     });
  //     player.addListener('account_error', ({ message }) => {
  //       console.error(message);
  //     });
  //     player.addListener('playback_error', ({ message }) => {
  //       console.error(message);
  //     });

  //     // Playback status updates
  //     player.addListener('player_state_changed', state => {
  //       console.log(state);
  //     });

  //     // Ready
  //     player.addListener('ready', ({ device_id }) => {
  //       console.log('Ready with Device ID', device_id);
  //     });

  //     // Not Ready
  //     player.addListener('not_ready', ({ device_id }) => {
  //       console.log('Device ID has gone offline', device_id);
  //     });

  //     // Connect to the player!
  //     player.connect();
  //   };
  // }
