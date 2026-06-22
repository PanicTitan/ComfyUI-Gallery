# folder_scanner.py
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from .metadata_extractor import buildMetadata  # Import metadata extractor

# Default extensions include images, media, audio, and 3D
DEFAULT_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.webp', '.gif',  # Images
    '.mp4', '.webm', '.mov',   # Media
    '.wav', '.mp3', '.m4a', '.flac',   # Audio
    '.obj', '.glb', '.gltf', '.fbx', '.stl', '.usd', '.usdz' # 3D
]

# Pre-built extension-to-type map for O(1) lookup
_EXT_TYPE_MAP = {}
for _ext in ['.png', '.jpg', '.jpeg', '.webp', '.gif']:
    _EXT_TYPE_MAP[_ext] = 'image'
for _ext in ['.mp4', '.webm', '.mov']:
    _EXT_TYPE_MAP[_ext] = 'media'
for _ext in ['.wav', '.mp3', '.m4a', '.flac']:
    _EXT_TYPE_MAP[_ext] = 'audio'
for _ext in ['.obj', '.glb', '.gltf', '.fbx', '.stl', '.usd', '.usdz']:
    _EXT_TYPE_MAP[_ext] = '3d'

# Max threads for parallel metadata extraction
_METADATA_WORKERS = min(8, (os.cpu_count() or 4))

def _extract_metadata_safe(full_path):
    """Extract metadata for a single image file, returning (full_path, metadata) or (full_path, {}) on error."""
    try:
        _, _, metadata = buildMetadata(full_path)
        return (full_path, metadata)
    except Exception as e:
        print(f"Gallery Node: Error building metadata for {full_path}: {e}")
        return (full_path, {})

def _scan_for_images(full_base_path, base_path, include_subfolders, allowed_extensions=None, deduplicate_symlinks=True):
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
    # Global visited set: used when deduplicate_symlinks is True to show content only once
    visited_dirs = set() if deduplicate_symlinks else None
    # Collect image paths that need metadata extraction
    metadata_tasks = []  # list of (folder_key, filename, full_path)

    def scan_directory(dir_path, relative_path="", ancestor_real_paths=None):
        """Recursively scans a directory for files matching allowed extensions."""
        nonlocal changed
        # Resolve real path to detect symlink cycles
        real_dir = os.path.realpath(dir_path)

        if deduplicate_symlinks:
            # Global deduplication: skip if this real path was already scanned anywhere
            if real_dir in visited_dirs:
                return
            visited_dirs.add(real_dir)
        else:
            # Stack-based cycle detection: only skip if this real path is an ancestor
            # in the current recursion chain (prevents infinite loops but allows
            # the same directory to appear in multiple branches of the tree)
            if ancestor_real_paths is None:
                ancestor_real_paths = set()
            if real_dir in ancestor_real_paths:
                return  # Cycle detected — skip to avoid infinite recursion
            ancestor_real_paths = ancestor_real_paths | {real_dir}  # New set for this branch

        folder_content = {}  # Dictionary to hold files for the current folder
        try:
            with os.scandir(dir_path) as it:
                file_entries = []
                for entry in it:
                    if entry.is_dir(follow_symlinks=True):
                        if include_subfolders and not entry.name.startswith("."):
                            next_relative_path = os.path.join(relative_path, entry.name)
                            scan_directory(entry.path, next_relative_path, ancestor_real_paths if not deduplicate_symlinks else None)
                    elif entry.is_file(follow_symlinks=True):
                        file_entries.append((entry.path, entry.name, entry.stat(follow_symlinks=True)))
                        current_files.add(entry.path)

            # Pre-compute subfolder string once per directory
            rel_path = os.path.relpath(dir_path, full_base_path)
            subfolder = rel_path if rel_path != "." else ""
            subfolder_prefix = f"/static_gallery/{subfolder}/" if subfolder else "/static_gallery/"

            for full_path, entry_name, stat in file_entries:
                lower_entry = entry_name.lower()
                if lower_entry.endswith(allowed_extensions_tuple):
                    try:
                        timestamp = stat.st_mtime
                        date_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
                        url_path = (subfolder_prefix + entry_name).replace("\\", "/")

                        ext = os.path.splitext(lower_entry)[1]
                        file_type = _EXT_TYPE_MAP.get(ext, "unknown")

                        folder_content[entry_name] = { 
                            "name": entry_name,
                            "url": url_path,
                            "timestamp": timestamp,
                            "date": date_str,
                            "metadata": {},  # Placeholder — filled in parallel below
                            "type": file_type
                        }

                        # Queue metadata extraction for images (the slow part)
                        if file_type == "image":
                            folder_key = os.path.join(base_path, relative_path).replace("\\", "/") if relative_path else base_path
                            metadata_tasks.append((folder_key, entry_name, full_path))

                    except Exception as e:
                        print(f"Gallery Node: Error processing file {full_path}: {e}")

            folder_key = os.path.join(base_path, relative_path).replace("\\", "/") if relative_path else base_path
            if folder_content:  # Only add folder if it has content
                folders_data[folder_key] = folder_content

        except Exception as e:
            print(f"Gallery Node: Error scanning directory {dir_path}: {e}")

    # Phase 1: Fast directory walk (no file I/O beyond stat)
    scan_directory(full_base_path, "")

    # Phase 2: Parallel metadata extraction for image files
    if metadata_tasks:
        with ThreadPoolExecutor(max_workers=_METADATA_WORKERS) as executor:
            future_to_key = {
                executor.submit(_extract_metadata_safe, full_path): (folder_key, filename)
                for folder_key, filename, full_path in metadata_tasks
            }
            for future in as_completed(future_to_key):
                folder_key, filename = future_to_key[future]
                try:
                    _, metadata = future.result()
                    if folder_key in folders_data and filename in folders_data[folder_key]:
                        folders_data[folder_key][filename]["metadata"] = metadata
                except Exception as e:
                    print(f"Gallery Node: Error in metadata thread for {filename}: {e}")

    return folders_data, changed