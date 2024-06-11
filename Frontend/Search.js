function saveUri() {
    var spotifyUri = document.getElementById('spotifyUri').value;

    // Simulate a save process with a simple condition
    if (spotifyUri) {
        // Simulating success
        alert('URI saved successfully');
        console.log('Saved URI:', spotifyUri);
    } else {
        // Simulating failure
        alert('Failed to save URI');
    }
}

function openModal() {
    document.getElementById('myModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('myModal').style.display = 'none';
}

function addToList() {
    var spotifyLink = document.getElementById('spotifyLink').value;
    console.log('Spotify Link:', spotifyLink); // Add logic to handle the Spotify link
    closeModal();
}

function handleFileUpload(files) {
    var file = files[0];
    console.log('Uploaded file:', file.name); // Add logic to handle the file upload
}
