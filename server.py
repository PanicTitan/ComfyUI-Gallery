from server import PromptServer
from aiohttp import web
import os
import folder_paths
import time
from datetime import datetime
import json
import math
import pathlib

from .folder_monitor import FileSystemMonitor, scan_directory_initial
from .folder_scanner import _scan_for_images

# Add ComfyUI root to sys.path HERE
import sys
comfy_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(comfy_path)

monitor = None
# Placeholder directory.  This *must* exist, even if it's empty.
PLACEHOLDER_DIR = os.path.abspath("./placeholder_static")
if not os.path.exists(PLACEHOLDER_DIR):
    os.makedirs(PLACEHOLDER_DIR)

# Add a *placeholder* static route.  This gets modified later.
PromptServer.instance.routes.static('/static_gallery', PLACEHOLDER_DIR, follow_symlinks=True, name='static_gallery_placeholder') #give a name to the route


def sanitize_json_data(data):
    """Recursively sanitizes data to be JSON serializable."""
    if isinstance(data, dict):
        return {k: sanitize_json_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_json_data(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif isinstance(data, (int, str, bool, type(None))):
        return data
    else:
        return str(data)


@PromptServer.instance.routes.get("/Gallery/images")
async def get_gallery_images(request):
    """Endpoint to get gallery images, accepts relative_path."""
    relative_path = request.rel_url.query.get("relative_path", "./")
    full_monitor_path = os.path.normpath(os.path.join(folder_paths.get_output_directory(), "..", "output", relative_path))

    try:
        folders_with_metadata, _ = _scan_for_images(
            full_monitor_path, "output", True
        )
        sanitized_folders = sanitize_json_data(folders_with_metadata)
        json_string = json.dumps({"folders": sanitized_folders})
        return web.Response(text=json_string, content_type="application/json")
    except Exception as e:
        print(f"Error in /Gallery/images: {e}")
        import traceback
        traceback.print_exc()
        return web.Response(status=500, text=str(e))

@PromptServer.instance.routes.post("/Gallery/monitor/start")
async def start_gallery_monitor(request):
    """Endpoint to start gallery monitoring, accepts relative_path."""
    global monitor
    if monitor and monitor.thread and monitor.thread.is_alive():
        print("FileSystemMonitor: Monitor already running, stopping previous monitor.")
        monitor.stop_monitoring()

    try:
        data = await request.json()
        relative_path = data.get("relative_path", "./")
        full_monitor_path = os.path.normpath(os.path.join(folder_paths.get_output_directory(), "..", "output", relative_path))

        if not os.path.isdir(full_monitor_path):
            return web.Response(status=400, text=f"Invalid relative_path: {relative_path}, path not found")

        # Find the existing placeholder route.
        for route in PromptServer.instance.app.router.routes():
            if route.name == 'static_gallery_placeholder':
                # Modify the existing route's resource.  This is a bit of a hack,
                # but it's the most reliable way to update a static route
                # without causing conflicts.
                route.resource._directory = pathlib.Path(full_monitor_path) #set the new directory
                print(f"Serving static files from {full_monitor_path} at /static_gallery")
                break  # Exit the loop once we've found and modified the route
        else:  # This 'else' belongs to the 'for' loop
            print("Error: Placeholder static route not found!")
            return web.Response(status=500, text="Placeholder route not found.")


        monitor = FileSystemMonitor(full_monitor_path)
        monitor.start_monitoring()
        return web.Response(text="Gallery monitor started", content_type="text/plain")

    except Exception as e:
        print(f"Error starting gallery monitor: {e}")
        import traceback
        traceback.print_exc()
        return web.Response(status=500, text=str(e))

@PromptServer.instance.routes.post("/Gallery/monitor/stop")
async def stop_gallery_monitor(request):
    """Endpoint to stop gallery monitoring."""
    global monitor
    if monitor and monitor.thread and monitor.thread.is_alive():
        monitor.stop_monitoring()
        monitor = None

    # Reset to placeholder.
    for route in PromptServer.instance.app.router.routes():
            if route.name == 'static_gallery_placeholder':
                route.resource._directory = pathlib.Path(PLACEHOLDER_DIR)
                print(f"Serving static files from {PLACEHOLDER_DIR} at /static_gallery")
                break
    return web.Response(text="Gallery monitor stopped", content_type="text/plain")

@PromptServer.instance.routes.patch("/Gallery/updateImages")
async def newSettings(request):
    # This route is no longer used
    return web.Response(status=200)
