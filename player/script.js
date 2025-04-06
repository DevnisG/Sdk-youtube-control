// Librerias:
// Libraries:
let player;
const socket = new WebSocket("ws://" + window.location.host + "/ws");
let timeUpdateInterval;

// YouTube API lista:
// YouTube API ready:
function onYouTubeIframeAPIReady() {
    console.log("YouTube API Ready");
    player = new YT.Player("player", {
        height: "100%",
        width: "100%",
        playerVars: { 
            'quality': 'hd720',
            'enablejsapi': 1,
            'playsinline': 1,
            'controls': 1,
            'rel': 0
        },
        events: {
            "onReady": onPlayerReady,
            "onStateChange": onPlayerStateChange,
            "onError": function(event) {
                console.error("Player Error:", event);
            }
        }
    });
}

// Actualizar información de tiempo:
// Update time info:
function updateTimeInfo() {
    try {
        if (player && player.getCurrentTime && player.getDuration) {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            const state = player.getPlayerState();
            const volume = player.getVolume();
            
            socket.send(JSON.stringify({
                type: 'timeUpdate',
                currentTime: currentTime,
                duration: duration,
                state: state,
                volume: volume
            }));
        }
    } catch (error) {
        console.error("Error updating time:", error);
    }
}

// Reproductor listo:
// Player ready:
function onPlayerReady(event) {                                                 
    window.player = player;
    timeUpdateInterval = setInterval(updateTimeInfo, 1000);
    
    socket.onmessage = function(event) {
        try {
            try {
                const jsonCommand = JSON.parse(event.data);
                if (jsonCommand.type === 'volume') {
                    console.log('Adjusting volume to:', jsonCommand.value);
                    player.setVolume(jsonCommand.value);
                    return;
                }
                if (jsonCommand.type === 'seek') {
                    player.seekTo(jsonCommand.time, true);
                    return;
                }
            } catch (e) {
            }

            const command = event.data;
            if (command.startsWith("play:")) {
                let videoId = command.split(":")[1];
                player.loadVideoById(videoId);
            } else if (command === "pause") {
                player.pauseVideo();
            } else if (command === "resume") {
                player.playVideo();
            } else if (command === "stop") {
                player.stopVideo();
            }
        } catch (error) {
            console.error("Error processing command:", error);
        }
    };
}

// Cambio de estado del reproductor:
// Player state change:
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        document.getElementById('playerPlaceholder').style.display = 'none';
    } else if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.UNSTARTED) {
        document.getElementById('playerPlaceholder').style.display = 'block';
    }
}