from server import PromptServer
from aiohttp import web
import os
import folder_paths
import time
from datetime import datetime
import json
import math
import pathlib
import threading
import queue
import asyncio
import shutil

from .folder_monitor import FileSystemMonitor
from .folder_scanner import _scan_for_images

# Add ComfyUI root to sys.path HERE
import sys
comfy_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(comfy_path)

monitor = None
# Placeholder directory.  This *must* exist, even if it's empty.
PLACEHOLDER_DIR = os.path.join(comfy_path, "output")  # os.path.abspath("./placeholder_static")
if not os.path.exists(PLACEHOLDER_DIR):
    os.makedirs(PLACEHOLDER_DIR)

# Add a *placeholder* static route.  This gets modified later.
PromptServer.instance.routes.static('/static_gallery', PLACEHOLDER_DIR, follow_symlinks=True, name='static_gallery_placeholder') #give a name to the route

# Initialize scan_lock here
PromptServer.instance.scan_lock = threading.Lock()

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
    # Fix: Only join if relative_path is not absolute or '.':
    base_output_dir = folder_paths.get_output_directory()
    if os.path.isabs(relative_path):
        full_monitor_path = os.path.normpath(relative_path)
    elif relative_path in ("./", ".", ""):  # treat as root
        full_monitor_path = base_output_dir
    else:
        full_monitor_path = os.path.normpath(os.path.join(base_output_dir, relative_path))

    # Use a thread-safe queue to communicate between threads.
    result_queue = queue.Queue()

    def thread_target():
        """Target function for the scanning thread."""
        with PromptServer.instance.scan_lock:
            try:
                # Use the actual folder name as the root key
                folder_name = os.path.basename(full_monitor_path)
                folders_with_metadata, _ = _scan_for_images(
                    full_monitor_path, folder_name, True
                )
                result_queue.put(folders_with_metadata)  # Put the result in the queue
            except Exception as e:
                result_queue.put(e)  # Put the exception in the queue

    def on_scan_complete(folders_with_metadata):
            """Callback executed in the main thread to send the response."""

            try:
                if isinstance(folders_with_metadata, Exception):
                    print(f"Error in /Gallery/images: {folders_with_metadata}")
                    import traceback
                    traceback.print_exc()
                    return web.Response(status=500, text=str(folders_with_metadata))

                sanitized_folders = sanitize_json_data(folders_with_metadata)
                json_string = json.dumps({"folders": sanitized_folders})
                return web.Response(text=json_string, content_type="application/json")
            except Exception as e:
                    print(f"Error in on_scan_complete: {e}")
                    return web.Response(status=500, text=str(e))


    # Start the scanning in a separate thread.
    scan_thread = threading.Thread(target=thread_target)
    scan_thread.start()
    # Wait result and process it.
    result = result_queue.get() # BLOCKING call
    return on_scan_complete(result)



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
                # Modify the existing route's resource.
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

@PromptServer.instance.routes.post("/Gallery/delete")
async def delete_image(request):
    """Endpoint to delete an image."""
    try:
        data = await request.json()
        image_url = data.get("image_path")  # Get the image URL
        if not image_url:
            return web.Response(status=400, text="image_path is required")
        # Extract relative path from URL
        if image_url.startswith("/static_gallery/"):
            relative_path = image_url[len("/static_gallery/"):]
        else:
            return web.Response(status=400, text="Invalid image_path format")
        # Get the static folder root (the directory being served)
        static_route = next((r for r in PromptServer.instance.app.router.routes() if getattr(r, 'name', None) == 'static_gallery_placeholder'), None)
        if static_route is not None:
            static_dir = str(static_route.resource._directory)
        else:
            # fallback to output dir
            static_dir = folder_paths.get_output_directory()
        # Compose the full path
        full_image_path = os.path.normpath(os.path.join(static_dir, relative_path))
        # Security checks:
        if not os.path.exists(full_image_path):
            return web.Response(status=404, text=f"File not found: {full_image_path}")
        if not full_image_path.startswith(os.path.realpath(static_dir)):
            return web.Response(status=403, text="Access denied: File outside of static directory")
        os.remove(full_image_path)
        return web.Response(text=f"Image deleted: {image_url}")
    except Exception as e:
        print(f"Error deleting image: {e}")
        return web.Response(status=500, text=str(e))

@PromptServer.instance.routes.post("/Gallery/move")
async def move_image(request):
    """Endpoint to move an image to a new location, relative to the current gallery root (current_path)."""
    try:
        data = await request.json()
        source_path = data.get("source_path")
        target_path = data.get("target_path")
        current_path = data.get("current_path") or data.get("relative_path") or "./"

        print(f"source_path: {source_path}")
        print(f"target_path: {target_path}")
        print(f"current_path: {current_path}")

        if not source_path or not target_path:
            return web.Response(status=400, text="source_path and target_path are required")

        # Get the static folder root (the directory being served)
        static_route = next((r for r in PromptServer.instance.app.router.routes() if getattr(r, 'name', None) == 'static_gallery_placeholder'), None)
        if static_route is not None:
            static_dir = str(static_route.resource._directory)
        else:
            static_dir = folder_paths.get_output_directory()

        static_dir_basename = os.path.basename(os.path.normpath(static_dir))

        def make_path(p):
            # If absolute, use as is
            if os.path.isabs(p):
                return os.path.normpath(p)
            # If starts with static_dir_basename, strip it
            if p.startswith(static_dir_basename + os.sep):
                p = p[len(static_dir_basename + os.sep):]
            elif p.startswith(static_dir_basename + "/"):
                p = p[len(static_dir_basename + "/"):]
            return os.path.normpath(os.path.join(static_dir, p))

        full_source_path = make_path(source_path)
        full_target_path = make_path(target_path)

        print(f"static_dir: {static_dir}")
        print(f"full_source_path: {full_source_path}")
        print(f"full_target_path: {full_target_path}")

        # Security checks (CRITICAL):
        if not os.path.exists(full_source_path):
            return web.Response(status=404, text=f"Source file not found: {full_source_path}")

        # Prevent path traversal outside of static_dir and comfy_path
        if not os.path.realpath(full_source_path).startswith(os.path.realpath(static_dir)) or \
           not os.path.realpath(full_target_path).startswith(os.path.realpath(static_dir)) or \
           not os.path.realpath(full_source_path).startswith(os.path.realpath(comfy_path)) or \
           not os.path.realpath(full_target_path).startswith(os.path.realpath(comfy_path)):
            return web.Response(status=403, text="Access denied: File outside of allowed directory")

        # If target is a directory, move into it
        if os.path.isdir(full_target_path):
            full_target_path = os.path.join(full_target_path, os.path.basename(full_source_path))

        # Create target directory if it doesn't exist:
        target_dir = os.path.dirname(full_target_path)
        if not os.path.exists(target_dir):
            os.makedirs(target_dir, exist_ok=True)

        # Perform the move:
        shutil.move(full_source_path, full_target_path)
        return web.Response(text=f"Image moved from {source_path} to {target_path}")

    except Exception as e:
        print(f"Error moving image: {e}")
        import traceback
        traceback.print_exc()  # Always good for debugging
        return web.Response(status=500, text=str(e))