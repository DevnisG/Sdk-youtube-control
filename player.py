# Librerias:
# Libraries:
import asyncio
import websockets
from pyppeteer import launch

# Correr el reproductor:
# Run the player:
async def run():
    browser = await launch({
        'headless': False,
        'executablePath': 'C:/Program Files/Google/Chrome/Application/chrome.exe', 
        'args': [
            '--autoplay-policy=no-user-gesture-required',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized',
        ],
        'defaultViewport': None,
    })

    pages = await browser.pages()
    page = pages[0]

    await page.evaluate('''() => {
        window.moveTo(0, 0);
        window.resizeTo(screen.width, screen.height);
    }''')

    # Ir a la página del reproductor:
    # Go to the player page:
    await page.goto('http://localhost:8000/player', {'waitUntil': 'networkidle2'})

    # Esperar a que la API de YouTube se cargue:
    # Wait for the YouTube API to load:
    await page.waitForFunction("typeof YT !== 'undefined'", {'timeout': 60000})

    # Esperar a que el reproductor se cargue:   
    # Wait for the player to load:
    await page.waitForFunction("window.player && typeof window.player.loadVideoById === 'function'", {'timeout': 60000})

    print("✅ Player Ready")

    # Conectar al servidor WebSocket:
    # Connect to the server WebSocket:
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as websocket:
        try:
            while True:
                message = await websocket.recv()
                if message == "server_shutdown":
                    print("Received shutdown command. Closing player...")
                    await browser.close()
                    break
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

# Ejecutar el reproductor:
# Run the player:
asyncio.run(run())
