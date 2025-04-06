# Librerias:
# Libraries:
import os
import sys
import time
import psutil
import asyncio
import requests
import uvicorn
import threading
import subprocess
from fastapi import FastAPI, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Configuración de FastAPI:
# Configure FastAPI:
app = FastAPI()
YOUTUBE_API_KEY = "YOUR_YOUTUBE_API_KEY"
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
clients = []  
playlist = []  
current_index = 0

# Verificar la validez de la clave de API de YouTube:
# Verify YouTube API key validity:
def verify_youtube_api_key():
    try:
        params = {
            "part": "snippet",
            "q": "test",
            "key": YOUTUBE_API_KEY,
            "type": "video",
            "maxResults": 1,
        }
        response = requests.get(YOUTUBE_SEARCH_URL, params=params)
        response.raise_for_status()
        print("✅ YouTube API key is valid")
        return True
    except requests.RequestException as e:
        print(f"❌ Error verifying YouTube API key: {e}")
        return False

# Configuración de CORS:
# CORS:
cors = CORSMiddleware(
    app=app,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar directorios estáticos:
# Mount static directories:
app.mount("/player", StaticFiles(directory="player"), name="player")
app.mount("/control", StaticFiles(directory="control"), name="control")

# Buscar música:
# Search music:
@app.get("/search-music")
def search_music(q: str = Query(..., min_length=1)):
    try:
        params = {
            "part": "snippet",
            "q": q,
            "key": YOUTUBE_API_KEY,
            "type": "video",
            "maxResults": 15,  
            "videoCategoryId": "10",
        }
        
        # Imprimir parámetros para depuración:
        # Print parameters for debugging
        print(f"Sending request to YouTube with parameters: {params}")
        
        response = requests.get(YOUTUBE_SEARCH_URL, params=params)
        
        # Imprimir la URL completa para depuración:
        # Print complete URL for debugging
        print(f"Complete URL: {response.url}")
        
        response.raise_for_status()  
        
        # Obtener los resultados de la respuesta:
        # Get results from the response
        data = response.json()
        results = []
        
        for item in data.get("items", []):
            try:
                video_id = item["id"]["videoId"]
                snippet = item["snippet"]
                results.append({
                    "video_id": video_id,
                    "title": snippet["title"],
                    "artist": snippet["channelTitle"],
                    "thumbnail": snippet["thumbnails"]["default"]["url"]
                })
            except KeyError as e:
                print(f"Error processing item: {e}")
                continue
                
        return {"results": results}
        
    except requests.RequestException as e:
        print(f"Error in YouTube request: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Error connecting to YouTube API"}
        )
    except Exception as e:
        print(f"Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

# Página del reproductor:
# Player page:
@app.get("/player", response_class=HTMLResponse)
def player():
    return open("player/index.html", encoding="utf-8").read()

# Página de control:
# Control page:
@app.get("/control", response_class=HTMLResponse)
def control():
    return open("control/index.html", encoding="utf-8").read()

# Conexión WebSocket:
# WebSocket connection:
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    global current_index
    try:
        while True:
            command = await websocket.receive_text()
            if command == "next":
                if playlist:
                    current_index = (current_index + 1) % len(playlist)
                    command = f"play:{playlist[current_index]}"
            elif command == "prev":
                if playlist:
                    current_index = (current_index - 1 + len(playlist)) % len(playlist)
                    command = f"play:{playlist[current_index]}"
            for client in clients:
                await client.send_text(command)
    except:
        clients.remove(websocket)

# Apagar el control y el reproductor:
# Shutdown the control and the player:
@app.get("/shutdown", response_class=HTMLResponse)
async def exit_server():
    for client in clients:
        try:
            await client.send_text("server_shutdown")
        except:
            pass

    for client in clients.copy():
        try:
            await client.close()
        except:
            pass
    
    clients.clear()
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if 'player.py' in ' '.join(proc.info['cmdline']):
                proc.kill()
        except:
            pass

    import os
    import signal
    os.kill(os.getpid(), signal.SIGTERM)
    
    return "Server and processes terminated."

# Ejecutar el control y el reproductor:
# Run the control and player:
if __name__ == "__main__":
    def run_api():
        uvicorn.run(app, host="0.0.0.0", port=8000)
    
    # Verificar la validez de la clave de API de YouTube:
    # Verify YouTube API key validity:
    if not verify_youtube_api_key():
        print("❌ YouTube API key is not valid. Music search will not work correctly.")
        print("⚠️ Please update the API key in control.py")
        print("🌐 For more information visit: https://developers.google.com/youtube?hl=es_419")
    
    # Ejecutar el control:
    # Run the control:
    api_thread = threading.Thread(target=run_api) 
    api_thread.start()
    
    # Esperar a que el control se cargue:
    # Wait for the control to load:
    time.sleep(3)

    # Ejecutar el reproductor:
    # Run the player:   
    venv_python = os.path.join(os.path.dirname(sys.executable), "python.exe")
    subprocess.run([venv_python, "player.py"])