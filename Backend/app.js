const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');
const dotenv = require('dotenv');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

global.access_token = ''

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/mydatabase')
  
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    
  });

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Define a schema for Spotify songs
const spotifySongSchema = new mongoose.Schema({
  spotifyLink: String,
  trackId: String,
  start: Number,
  end: Number,
  speed: Number,
  key: Number
});

const SpotifySong = mongoose.model('SpotifySong', spotifySongSchema);

// Define a schema for Recommended songs
const recommendedSongSchema = new mongoose.Schema({
  spotifyLink: String,
  trackId: String,
  start: Number,
  end: Number,
  speed: Number,
  key: Number
});

const RecommendedSong = mongoose.model('RecommendedSong', recommendedSongSchema);

const Userprefschema = new mongoose.Schema({
  spotifyLink: String,
  trackId: String,
  start: Number,
  end: Number,
  speed: Number,
  key: Number
});

const Userprefsongs = mongoose.model('Userprefsongs', Userprefschema);



var client_id = 'b42c8d194cce4846bbee040967fd8b5d'
var client_secret = '1d936cfb130d4799981e1f68d622adca'

let access_token; // Define access_token in the outer scope

app.get('/login', function(req, res) {
  
  var scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-modify-public playlist-modify-private ugc-image-upload user-follow-read user-follow-modify user-library-read user-library-modify user-read-playback-position user-read-recently-played user-top-read app-remote-control streaming';
  var state = generateRandomString(16);
  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: scope,
    redirect_uri: "http://localhost:3000/",
    state: state
  })

  res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
});



app.get('/auth/callback', (req, res) => {

  var code = req.query.code;

  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: "http://localhost:8080/callback",
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.redirect('/')
    }
  });
})

app.get('/auth/token', (req, res) => {
  // Return the stored access token
  res.json({ access_token: access_token });
});



// Route to fetch access token from Spotify using Client Credentials flow
app.get('/getToken', (req, res) => {
  const tokenEndpoint = 'https://accounts.spotify.com/api/token';
  const postQuery = 'grant_type=client_credentials&scope=playlist-modify-public%20playlist-read-private%20playlist-modify-private%20app-remote-control%20streaming%20user-read-email%20user-read-private%20user-modify-playback-state';

  const auth = 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64');
  
  axios.post(tokenEndpoint, postQuery, {
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  })
  .then(response => {
    const accessToken = response.data.access_token;
    res.send(accessToken);
  })
  .catch(error => {
    console.error('Failed to fetch access token:', error);
    res.status(500).send('Failed to fetch access token');
  });
});

// Route to fetch saved data from the database (SpotifySong)
app.get('/getData', async (req, res) => {
  try {
    const songs = await SpotifySong.find();
    res.json(songs);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to fetch saved data from the database (RecommendedSong)
app.get('/getDataRec', async (req, res) => {
  try {
    const songs = await RecommendedSong.find();
    res.json(songs);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/getDataUserpref', async (req, res) => {   // (Userpref)
  try {
    const songs = await Userprefsongs.find();
    res.json(songs);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


// Route to save data to the database (SpotifySong)
app.post('/saveData', async (req, res) => {
  try {
      const dataToSave = req.body; // Assuming dataToSave is an array of objects
      if (!Array.isArray(dataToSave)) {
          throw new Error('Data to save must be an array');
      }
      // Validate data before saving (you can implement your own validation logic here)
      // For example, ensure that each object in the array has all required fields

      // Perform the saving operation here, e.g., saving to MongoDB
      await SpotifySong.insertMany(dataToSave);
      res.status(200).json({ message: 'Data saved successfully' }); // Sending JSON response
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' }); // Sending JSON response
  }
});
app.post('/saveDatarec', async (req, res) => {
  try {
      const dataToSave = req.body; // Assuming dataToSave is an array of objects
      if (!Array.isArray(dataToSave)) {
          throw new Error('Data to save must be an array');
      }
      // Validate data before saving (you can implement your own validation logic here)
      // For example, ensure that each object in the array has all required fields

      // Perform the saving operation here, e.g., saving to MongoDB
      await RecommendedSong.insertMany(dataToSave);
      res.status(200).json({ message: 'Data saved successfully' }); // Sending JSON response
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' }); // Sending JSON response
  }
});
// Route to save data to the database (Userpref)
app.post('/saveDataUserpref', async (req, res) => {
  try {
      const { songs } = req.body; // Extracting the songs array from the request body
      if (!Array.isArray(songs)) {
          throw new Error('Data to save must be an array');
      }

 
      songs.forEach(song => {
          if (!song.spotifyLink || !song.trackId || song.start == null || song.end == null || song.speed == null || song.key == null) {
              throw new Error('Invalid song data');
          }
      });

      // Perform the saving operation here, e.g., saving to MongoDB
      await Userprefsongs.insertMany(songs);
      res.status(200).json({ message: 'Data saved successfully' }); // Sending JSON response
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' }); // Sending JSON response
  }
});


// Route to delete all data from the database (SpotiftSong)
app.delete('/deleteOldData', async (req, res) => {
  try {
    // Delete all documents in the collection
    await SpotifySong.deleteMany({});
    res.status(200).send('Old data deleted successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to delete all data from the database (RecommendedSong)
app.delete('/deleteOldDataRec', async (req, res) => {
  try {
    // Delete all documents in the collection
    await RecommendedSong.deleteMany({});
    res.status(200).send('Old data deleted successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.delete('/deleteOldDataUserpref', async (req, res) => {
  try {
    // Delete all documents in the collection
    await Userprefsongs.deleteMany({});
    res.status(200).send('Old data deleted successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


function generateRandomString(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomString = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    randomString += charset[randomIndex];
  }
  return randomString;
}

let userPreferences = {};

app.post('/process-user-preferences', (req, res) => {
    const { spotifyPlaylist, age } = req.body; 
    userPreferences = { spotifyPlaylist, age };
    res.json({ message: 'User preferences received and processed' });
});
app.get('/fetch-tracks', (req, res) => {
  const { spotifyPlaylist, age } = userPreferences;
  const cleanPlaylistId = spotifyPlaylist.split('?')[0]; 
  const command = `python Userpref.py ${cleanPlaylistId} ${age}`;
  exec(command, (error, stdout, stderr) => {
      if (error) {
          console.error(`exec error: ${error}`);
          return res.status(500).send('Error executing script');
      }

      try {
          const trackData = JSON.parse(stdout);
          res.json(trackData);
      } catch (parseError) {
          console.error(`parse error: ${parseError}`);
          res.status(500).send('Error parsing script output');
      }
  });
});