async function playSong(trackUri) {
    // Define state for semitone
    const [semitone, setSemitone] = useState(0);

    // Function to handle semitone change
    const changeSemitone = (event) => {
      setSemitone(event.target.value);
    };

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

