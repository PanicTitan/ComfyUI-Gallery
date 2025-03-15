class GalleryNode:

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "gallery_node"
    CATEGORY = "utils"
    OUTPUT_NODE = True

    def gallery_node(self):
        # Initial load is handled by server startup.
        return ()

NODE_CLASS_MAPPINGS = {"GalleryNode": GalleryNode}
NODE_DISPLAY_NAME_MAPPINGS = {"GalleryNode": "Gallery Button"}
