# ComfyUI Gallery

**Effortlessly Browse Your ComfyUI Image Outputs!**

This custom node for ComfyUI provides a dynamic gallery directly within the ComfyUI interface, allowing you to view, search, sort, and inspect metadata of your generated images in real-time. Say goodbye to manually navigating folders – your output images are now just a click away!

![ComfyUI Gallery Node in Action](showcase.gif)

> **Visualize your creative output directly in ComfyUI and unlock image metadata at your fingertips!**

## Key Features:

* **Real-time Gallery Updates:** Automatically detects new images saved to your ComfyUI output folder and updates the gallery instantly, without browser refresh.
* **Image Metadata Extraction:** Extracts and displays detailed metadata embedded in your PNG, JPG, and WebP images, including workflow, prompts, settings, and more. (Powered by [ComfyUI-Crystools](https://github.com/crystian/ComfyUI-Crystools) - credits below).
* **Detailed Image Information Window:** Click "Info" on any image to open a dedicated window showing a larger preview and structured metadata (filename, resolution, size, date, prompts, sampler, seed, model, LoRAs, etc.).
* **Raw Metadata Viewer:**  Dive deep into the technical details with a "Show Raw Metadata" button, displaying the full JSON metadata in a scrollable text area.
* **Search and Filter:** Quickly find images by filename using the built-in search bar.
* **Sorting Options:** Organize your gallery by Newest, Oldest, Name (Ascending), or Name (Descending) for easy browsing.
* **User-Friendly Interface:** Intuitive and clean design seamlessly integrates into the ComfyUI environment.
* **Lazy Loading:**  Efficiently loads images as you scroll, ensuring smooth performance even with large output folders.

## Get Started:

**1. Installation:**

* **Using ComfyUI Manager (Recommended):**
    * Open ComfyUI Manager within ComfyUI.
    * Go to "Install Custom Nodes".
    * Search for `ComfyUI-Gallery` and install it.
    * **Restart ComfyUI after installation.**

* **Install via Git URL:**
    * Navigate to your `ComfyUI/custom_nodes` directory.
    * Clone this repository using git:
      ```bash
      git clone https://github.com/PanicTitan/ComfyUI-Gallery.git 
      ```
    * **Restart ComfyUI after installation.**

**2. Install Python Dependencies:**

* **Using ComfyUI Manager (Recommended):** After installing the node, ComfyUI Manager might prompt you to install missing dependencies. Click "Install Missing" to automatically install required Python packages.
* **Manual Installation:** If you installed manually via Git URL, you can install dependencies using pip:
    ```bash
    cd ComfyUI/custom_nodes/ComfyUI-Gallery 
    pip install -r requirements.txt
    ```

**3. Load and Use the Gallery Node:**

* If the "Open Gallery" button don't appear in ComfyUI top right side of the topbar, add the "Gallery Openner" node (Category: `Gallery`) to your workflow, and reload the tab.
* Start generating images in ComfyUI. As images are saved to your output folder, they will appear in the gallery in real-time.
* Use the search bar, sort buttons, and "Info" buttons to explore your image collection.

## Credits and Inspiration:

* **ComfyUI:** [https://github.com/comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) - The foundation and inspiration for this custom node.
* **ComfyUI-Crystools Metadata Extraction:** [https://github.com/crystian/ComfyUI-Crystools](https://github.com/crystian/ComfyUI-Crystools) - Code and logic adapted from Crystools for robust image metadata extraction.
* **aiohttp:** [https://github.com/aio-libs/aiohttp](https://github.com/aio-libs/aiohttp) -  Used for the asynchronous web server component.
* **Pillow (PIL):** [https://python-pillow.org/](https://python-pillow.org/) -  For image processing and metadata handling.
* **ComfyUI Manager:** [https://github.com/ltdrdata/ComfyUI-Manager](https://github.com/ltdrdata/ComfyUI-Manager) - For streamlined installation and dependency management.

**Enjoy using the ComfyUI Gallery Output Viewer Node!  Contributions, bug reports, and feature requests are welcome!**

<div align="center">
     <img src="logo.png" width="300" height="auto" alt="ComfyUI Gallery Viewer Logo">
</div>

---
*README.md Generated By AI Assistant ✨*