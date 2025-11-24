# folder_scanner.py
import os
from datetime import datetime
from .metadata_extractor import buildMetadata  # Import metadata extractor

# Default extensions include images, media and audio
DEFAULT_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.webp',  # Images
    '.mp4', '.gif', '.webm', '.mov',   # Media
    '.wav', '.mp3', '.m4a', '.flac'    # Audio
]

def _scan_for_images(full_base_path, base_path, include_subfolders, allowed_extensions=None):
    """Scans directories for files matching allowed extensions."""
    if allowed_extensions is None:
        allowed_extensions = DEFAULT_EXTENSIONS

    # Normalize extensions to a tuple for str.endswith checks
    allowed_extensions_tuple = tuple(
        ext.lower() if ext.startswith('.') else f".{ext.lower()}" 
        for ext in allowed_extensions
    )

    folders_data = {}
    current_files = set()
    changed = False

    def scan_directory(dir_path, relative_path=""):
        """Recursively scans a directory for files matching allowed extensions."""
        nonlocal changed
        folder_content = {}  # Dictionary to hold files for the current folder
        try:
            entries = os.listdir(dir_path)
            file_entries = []

            for entry in entries:
                full_path = os.path.join(dir_path, entry)
                if os.path.isdir(full_path):
                    if include_subfolders and not entry.startswith("."):
                        next_relative_path = os.path.join(relative_path, entry)
                        scan_directory(full_path, next_relative_path)
                elif os.path.isfile(full_path):
                    file_entries.append((full_path, entry))
                    current_files.add(full_path)

            for full_path, entry in file_entries:
                lower_entry = entry.lower()
                if lower_entry.endswith(allowed_extensions_tuple):
                    try:
                        timestamp = os.path.getmtime(full_path)
                        date_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
                        rel_path = os.path.relpath(dir_path, full_base_path)
                        filename = entry
                        subfolder = rel_path if rel_path != "." else ""
                        if len(subfolder) > 0:
                            url_path = f"/static_gallery/{subfolder}/{filename}"
                        else:
                            url_path = f"/static_gallery/{filename}"
                        url_path = url_path.replace("\\", "/")

                        # Default metadata and type detection
                        metadata = {}
                        file_type = "unknown"
                        ext = os.path.splitext(lower_entry)[1]

                        if ext in ['.png', '.jpg', '.jpeg', '.webp']:
                            file_type = "image"
                            try:
                                _, _, metadata = buildMetadata(full_path)
                            except Exception as e:
                                print(f"Gallery Node: Error building metadata for {full_path}: {e}")
                                metadata = {}
                        elif ext in ['.mp4', '.gif', '.webm', '.mov']:
                            file_type = "media"
                        elif ext in ['.wav', '.mp3', '.m4a', '.flac']:
                            file_type = "audio"

                        folder_content[filename] = { 
                            "name": entry,
                            "url": url_path,
                            "timestamp": timestamp,
                            "date": date_str,
                            "metadata": metadata,
                            "type": file_type
                        }
                    except Exception as e:
                        print(f"Gallery Node: Error processing file {full_path}: {e}")

            folder_key = os.path.join(base_path, relative_path) if relative_path else base_path
            if folder_content: # Only add folder if it has content
                folders_data[folder_key] = folder_content

        except Exception as e:
            print(f"Gallery Node: Error scanning directory {dir_path}: {e}")

    scan_directory(full_base_path, "")
    return folders_data, changed