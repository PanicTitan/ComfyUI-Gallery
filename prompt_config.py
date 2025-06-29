# ComfyUI Gallery - Prompt Extraction Configuration
# This file allows customization of how positive and negative prompts are extracted

class PromptExtractionConfig:
    """Configuration for ComfyUI prompt extraction"""
    
    # Node types that can contain prompts
    PROMPT_NODE_TYPES = {
        "CLIPTextEncode": {"priority": 1, "text_field": "text"},
        "CR Prompt Text": {"priority": 2, "text_field": "text"}, 
        "ImpactWildcardProcessor": {"priority": 3, "text_field": "wildcard_text"},
        "Textbox": {"priority": 4, "text_field": "text"},
        "easy showAnything": {"priority": 5, "text_field": "anything"},
        "StringFunction": {"priority": 6, "text_field": "value"},
        "Text Multiline": {"priority": 7, "text_field": "text"},
        # Add custom node types here:
        # "YourCustomNode": {"priority": 8, "text_field": "your_field"},
    }
    
    # Node IDs commonly used in basic ComfyUI workflows
    BASIC_WORKFLOW_MAPPING = {
        "positive_ids": ["2", "6", "7", "11", "12"],  # Common positive prompt node IDs
        "negative_ids": ["3", "7", "8", "13", "14"],  # Common negative prompt node IDs
        "model_ids": ["1", "4", "5"],                  # Model loader node IDs
        "sampler_ids": ["10", "15", "16"],            # KSampler node IDs
    }
    
    # Keywords for heuristic-based prompt detection
    POSITIVE_INDICATORS = [
        "positive", "masterpiece", "best quality", "high quality",
        "detailed", "beautiful", "amazing", "stunning", "perfect",
        "photorealistic", "professional", "artistic", "elegant"
    ]
    
    NEGATIVE_INDICATORS = [
        "negative", "bad", "worst quality", "low quality", "poor quality",
        "blurry", "distorted", "ugly", "deformed", "artifact", "noise",
        "overexposed", "underexposed", "cropped", "out of frame"
    ]
    
    # Color-based detection (for node UI colors)
    NODE_COLORS = {
        "positive_colors": ["#232", "#2a2", "#353", "#3a3"],  # Green tones
        "negative_colors": ["#322", "#533", "#a22", "#533"],  # Red/orange tones
    }
    
    # Extraction settings
    EXTRACTION_SETTINGS = {
        "min_prompt_length": 3,           # Minimum characters for valid prompt
        "max_prompt_length": 10000,       # Maximum characters to prevent memory issues
        "prefer_titled_nodes": True,      # Prefer nodes with "Positive/Negative Prompt" titles
        "use_heuristics": True,          # Use keyword-based detection as fallback
        "use_color_hints": False,        # Use node colors for detection (can be unreliable)
        "deduplicate_prompts": True,     # Remove duplicate prompts
        "trim_whitespace": True,         # Clean up prompt text
    }
    
    # Custom extraction rules (advanced users)
    CUSTOM_RULES = [
        # Example: Extract from custom node with specific pattern
        # {
        #     "node_type": "MyCustomPromptNode",
        #     "extraction_method": "custom",
        #     "positive_field": "pos_prompt",
        #     "negative_field": "neg_prompt"
        # }
    ]

# Easy way to modify configuration
def update_config(**kwargs):
    """Update configuration values dynamically"""
    for key, value in kwargs.items():
        if hasattr(PromptExtractionConfig, key.upper()):
            setattr(PromptExtractionConfig, key.upper(), value)
        else:
            print(f"Warning: Unknown configuration key: {key}")

# Example usage:
# update_config(min_prompt_length=5, prefer_titled_nodes=False) 