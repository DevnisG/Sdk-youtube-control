// Librerias:
// Libraries:
const socket = new WebSocket("ws://" + window.location.host + "/ws");
let currentPlaylist = [];
let currentIndex = -1;
let lastVolume = 100;
let currentVolume = 100;

// Formato de tiempo:
// Format time:
function formatTime(seconds) {
    seconds = Math.floor(seconds);
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Buscar música:
// Seek to position:
function seekToPosition(event) {
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const duration = parseFloat(progressBar.dataset.duration || 0);
    const seekTime = percentage * duration;
    
    socket.send(JSON.stringify({
        type: 'seek',
        time: seekTime
    }));
}

// Inicializar control de volumen:
// Initialize volume control:
function initVolumeControl() {
    const volumeBarContainer = document.getElementById('volumeBarContainer');
    
    function handleVolumeChange(e) {
        const rect = volumeBarContainer.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = Math.round((x / rect.width) * 100);
        updateVolume(percentage);
    }

    volumeBarContainer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleVolumeChange(e);
        
        function onMouseMove(e) {
            e.preventDefault();
            handleVolumeChange(e);
        }
        
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// Actualizar volumen:
// Update volume:
function updateVolume(value) {
    value = Math.max(0, Math.min(100, value));
    currentVolume = value;
    
    const volumeBar = document.getElementById('volumeBar');
    const volumeLabel = document.getElementById('volumeLabel');
    const volumeIcon = document.getElementById('volumeIcon');

    volumeBar.style.width = `${value}%`;
    volumeLabel.textContent = `${value}%`;

    if (value === 0) {
        volumeIcon.textContent = '🔇';
    } else if (value < 50) {
        volumeIcon.textContent = '🔉';
    } else {
        volumeIcon.textContent = '🔊';
    }

    socket.send(JSON.stringify({
        type: 'volume',
        value: value
    }));
}

// Cambiar a unmute / mute:
// Toggle mute:
function toggleMute() {
    if (currentVolume > 0) {
        lastVolume = currentVolume;
        updateVolume(0);
    } else {
        updateVolume(lastVolume);
    }
}

// Actualizar progreso:
// Update progress:
socket.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'timeUpdate') {
            updateProgress(data.currentTime, data.duration, data.state);
            if (data.volume !== undefined && Math.abs(data.volume - currentVolume) > 1) {
                updateVolume(data.volume);
            }
        }
    } catch (e) {
    }
};

// Actualizar progreso:
// Update progress:
function updateProgress(currentTime, duration, state) {
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const playerStatus = document.getElementById('playerStatus');

    const percentage = (currentTime / duration) * 100;
    progress.style.width = `${percentage}%`;
    progressBar.dataset.duration = duration;

    currentTimeDisplay.textContent = formatTime(currentTime);
    durationDisplay.textContent = formatTime(duration);

    const states = {
        '-1': 'No iniciado',
        '0': 'Finalizado',
        '1': 'Reproduciendo',
        '2': 'Pausado',
        '3': 'Almacenando',
        '5': 'Video en cola'
    };
    playerStatus.textContent = `Estado: ${states[state] || 'Desconocido'}`;
}

// Buscar música:
// Search music:
function searchMusic() {
    const query = document.getElementById("searchQuery").value;
    if (!query) {
        alert("Por favor ingresa un término de búsqueda");
        return;
    }

    fetch(`/search-music?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            currentPlaylist = data.results;
            displayResults(data.results);
        })
        .catch(error => {
            console.error("Error en la búsqueda:", error);
            alert("Error al buscar música. Por favor intenta de nuevo.");
        });
}

// Mostrar resultados:
// Display results:
function displayResults(results) {
    const resultsDiv = document.getElementById("results");
    if (results.length === 0) {
        resultsDiv.innerHTML = "<p>No se encontraron resultados.</p>";
        return;
    }

    resultsDiv.innerHTML = results.map((song, index) => `
        <div class="song-item">
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <button class="play-button" onclick="playSong(${index})">▶️</button>
        </div>
    `).join("");
}

// Reproducir canción:
// Play song:
function playSong(index) {
    if (index >= 0 && index < currentPlaylist.length) {
        currentIndex = index;
        const song = currentPlaylist[index];
        sendCommand(`play:${song.video_id}`);
        updateCurrentlyPlaying(song);
    }
}

// Reproducir siguiente canción:
// Play next:
function playNext() {
    if (currentPlaylist.length > 0) {
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
        playSong(currentIndex);
    }
}

// Reproducir canción anterior:
// Play previous:
function playPrevious() {
    if (currentPlaylist.length > 0) {
        currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playSong(currentIndex);
    }
}

// Actualizar canción actual:
// Update currently playing:
function updateCurrentlyPlaying(song) {
    const currentlyPlaying = document.getElementById("currentlyPlaying");
    const currentSong = document.getElementById("currentSong");
    currentlyPlaying.style.display = "block";
    currentSong.textContent = `${song.title} - ${song.artist}`;
}

// Enviar comando:
// Send command:
function sendCommand(cmd) {
    try {
        socket.send(cmd);
    } catch (error) {
        console.error("Error al enviar comando:", error);
        alert("Error de conexión. Por favor recarga la página.");
    }
}

// Error de WebSocket:
// On error:
socket.onerror = function(error) {
    console.error("Error de WebSocket:", error);
    alert("Error de conexión. Por favor recarga la página.");
};

// Cerrar conexión WebSocket:
// On close:
socket.onclose = function(event) {
    console.log("Conexión WebSocket cerrada:", event);
    alert("Se perdió la conexión. Por favor recarga la página.");
};

// Tecla ENTER presionada:
// On keypress ENTER KEY:
document.getElementById("searchQuery").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchMusic();
    }
});

// Inicializar control de volumen:   
// Initialize volume control:   
document.addEventListener('DOMContentLoaded', () => {
    initVolumeControl();
    updateVolume(100);
});
