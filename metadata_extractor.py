import os
import json
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageOps
from PIL.ExifTags import TAGS, GPSTAGS, IFD
from PIL.PngImagePlugin import PngImageFile
from PIL.JpegImagePlugin import JpegImageFile
import re
from typing import Dict, Any, Optional, List, Tuple

# Import folder_paths conditionally (ComfyUI specific)
try:
    import folder_paths
except ImportError:
    # When running standalone, folder_paths is not available
    folder_paths = None

try:
    from .prompt_config import PromptExtractionConfig
except ImportError:
    try:
        # Try absolute import for standalone usage
        from prompt_config import PromptExtractionConfig
    except ImportError:
        # Fallback if config file is not available
        class PromptExtractionConfig:
            POSITIVE_KEYWORDS = ["positive", "masterpiece", "best quality", "high quality", "detailed"]
            NEGATIVE_KEYWORDS = ["negative", "bad", "worst quality", "low quality", "blurry"]
            BASIC_WORKFLOW_IDS = {
                'positive': ['2', '6', '7'],
                'negative': ['3', '7', '8'],
            }

CONFIG_INDENT = 4  # Assuming a default indent value if CONFIG is not available

def get_size(file_path):
    file_size_bytes = os.path.getsize(file_path)
    if file_size_bytes < 1024:
        return f"{file_size_bytes} bytes"
    elif file_size_bytes < 1024 * 1024:
        return f"{file_size_bytes / 1024:.2f} KB"
    else:
        return f"{file_size_bytes / (1024 * 1024):.2f} MB"


class ComfyUIPromptParser:
    """Enhanced parser for ComfyUI prompt data with multiple extraction strategies"""
    
    @staticmethod
    def get_prompt_node_types():
        """Get configured prompt node types"""
        if hasattr(PromptExtractionConfig, 'PROMPT_NODE_TYPES'):
            return list(PromptExtractionConfig.PROMPT_NODE_TYPES.keys())
        return ["CLIPTextEncode", "CR Prompt Text", "ImpactWildcardProcessor", 
                "Textbox", "easy showAnything", "StringFunction", "Text Multiline"]
    
    @staticmethod
    def get_workflow_ids():
        """Get configured workflow node IDs"""
        if hasattr(PromptExtractionConfig, 'BASIC_WORKFLOW_MAPPING'):
            return PromptExtractionConfig.BASIC_WORKFLOW_MAPPING
        return PromptExtractionConfig.BASIC_WORKFLOW_IDS
    
    @staticmethod
    def get_positive_keywords():
        """Get configured positive keywords"""
        if hasattr(PromptExtractionConfig, 'POSITIVE_INDICATORS'):
            return PromptExtractionConfig.POSITIVE_INDICATORS
        return PromptExtractionConfig.POSITIVE_KEYWORDS
    
    @staticmethod
    def get_negative_keywords():
        """Get configured negative keywords"""
        if hasattr(PromptExtractionConfig, 'NEGATIVE_INDICATORS'):
            return PromptExtractionConfig.NEGATIVE_INDICATORS
        return PromptExtractionConfig.NEGATIVE_KEYWORDS

    @staticmethod
    def extract_prompts_from_workflow(workflow_data: Dict[str, Any]) -> Dict[str, Optional[str]]:
        """Extract positive and negative prompts from workflow data"""
        result = {"positive": None, "negative": None}
        
        if not workflow_data:
            return result
            
        # Strategy 1: Try node-based extraction for workflow with nodes array
        if "nodes" in workflow_data and isinstance(workflow_data["nodes"], list):
            result.update(ComfyUIPromptParser._extract_from_nodes_array(workflow_data["nodes"]))
        
        # Strategy 2: Try basic workflow structure (key-value pairs)
        elif isinstance(workflow_data, dict):
            result.update(ComfyUIPromptParser._extract_from_basic_workflow(workflow_data))
            
        return result

    @staticmethod
    def _extract_from_nodes_array(nodes: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
        """Extract prompts from nodes array (advanced workflows)"""
        result = {"positive": None, "negative": None}
        
        for node in nodes:
            if not isinstance(node, dict):
                continue
                
            node_type = node.get("type", "")
            title = node.get("title", "").lower()
            widgets_values = node.get("widgets_values", [])
            
            # Check by title first (most reliable)
            if "positive" in title and "prompt" in title:
                if widgets_values and result["positive"] is None:
                    result["positive"] = str(widgets_values[0]) if widgets_values[0] else None
                    
            elif "negative" in title and "prompt" in title:
                if widgets_values and result["negative"] is None:
                    result["negative"] = str(widgets_values[0]) if widgets_values[0] else None
            
            # Check by node type and heuristics
            elif node_type in ComfyUIPromptParser.get_prompt_node_types():
                if widgets_values:
                    text_content = str(widgets_values[0]) if widgets_values[0] else ""
                    
                    # Try to detect positive prompt
                    if result["positive"] is None and ComfyUIPromptParser._is_positive_prompt(text_content):
                        result["positive"] = text_content
                    
                    # Try to detect negative prompt  
                    elif result["negative"] is None and ComfyUIPromptParser._is_negative_prompt(text_content):
                        result["negative"] = text_content
        
        return result

    @staticmethod
    def _extract_from_basic_workflow(workflow: Dict[str, Any]) -> Dict[str, Optional[str]]:
        """Extract prompts from basic workflow structure"""
        result = {"positive": None, "negative": None}
        
        for node_id, node_data in workflow.items():
            if not isinstance(node_data, dict):
                continue
                
            inputs = node_data.get("inputs", {})
            
            workflow_ids = ComfyUIPromptParser.get_workflow_ids()
            
            # Check for common positive prompt locations
            if node_id in workflow_ids.get('positive_ids', workflow_ids.get('positive', [])):
                if "text" in inputs and result["positive"] is None:
                    result["positive"] = str(inputs["text"])
                elif "prompt" in inputs and result["positive"] is None:
                    result["positive"] = str(inputs["prompt"])
                    
            # Check for common negative prompt locations
            elif node_id in workflow_ids.get('negative_ids', workflow_ids.get('negative', [])):
                if "text" in inputs and result["negative"] is None:
                    result["negative"] = str(inputs["text"])
                elif "prompt" in inputs and result["negative"] is None:
                    result["negative"] = str(inputs["prompt"])
        
        return result

    @staticmethod
    def _is_positive_prompt(text: str) -> bool:
        """Heuristic to determine if text is likely a positive prompt"""
        if not text:
            return False
            
        text_lower = text.lower()
        
        # Check for positive keywords
        positive_keywords = ComfyUIPromptParser.get_positive_keywords()
        positive_score = sum(1 for keyword in positive_keywords 
                           if keyword in text_lower)
        
        # Check for negative keywords (reduces positive score)
        negative_keywords = ComfyUIPromptParser.get_negative_keywords()
        negative_score = sum(1 for keyword in negative_keywords 
                           if keyword in text_lower)
        
        # Strong negative indicators that definitely make it NOT positive
        strong_negative_indicators = [
            "worst quality", "low quality", "bad", "ugly", "blurry", 
            "distorted", "deformed", "amateur", "poor quality"
        ]
        has_strong_negative = any(phrase in text_lower for phrase in strong_negative_indicators)
        
        # If it has strong negative indicators, it's definitely not positive
        if has_strong_negative:
            return False
            
        # Strong positive indicators
        strong_positive_indicators = [
            "masterpiece", "best quality", "high quality", "detailed", 
            "professional", "photorealistic", "stunning", "beautiful"
        ]
        has_strong_positive = any(phrase in text_lower for phrase in strong_positive_indicators)
        
        # If it has strong positive indicators, it's likely positive
        if has_strong_positive:
            return True
        
        # Positive prompts are usually longer and more descriptive
        length_bonus = 1 if len(text) > 50 else 0
        
        # More positive keywords than negative, or has length advantage
        return (positive_score + length_bonus) > negative_score and positive_score > 0

    @staticmethod
    def _is_negative_prompt(text: str) -> bool:
        """Heuristic to determine if text is likely a negative prompt"""
        if not text:
            return False
            
        text_lower = text.lower()
        
        # Check for negative keywords
        negative_keywords = ComfyUIPromptParser.get_negative_keywords()
        negative_score = sum(1 for keyword in negative_keywords 
                           if keyword in text_lower)
        
        # Check for positive keywords (reduces likelihood of being negative)
        positive_keywords = ComfyUIPromptParser.get_positive_keywords()
        positive_score = sum(1 for keyword in positive_keywords 
                           if keyword in text_lower)
        
        # Strong negative indicators that are very likely to be negative prompts
        strong_negative_indicators = [
            "worst quality", "low quality", "bad", "ugly", "blurry", 
            "distorted", "deformed", "amateur", "poor quality"
        ]
        strong_negative = any(phrase in text_lower for phrase in strong_negative_indicators)
        
        # If it has strong negative indicators, it's likely negative
        if strong_negative:
            return True
            
        # If it has more negative keywords than positive, it's likely negative
        if negative_score > positive_score and negative_score > 0:
            return True
            
        # If text is short and contains negative words, likely negative
        if len(text) < 100 and negative_score > 0:
            return True
            
        return False


def extract_structured_prompts(prompt_data: Dict[str, Any], workflow_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract structured prompt information from ComfyUI data"""
    structured_prompts = {
        "positive": None,
        "negative": None,
        "parameters": {},
        "extraction_method": "unknown"
    }
    
    # Try to extract from workflow first (more reliable)
    if workflow_data:
        extracted = ComfyUIPromptParser.extract_prompts_from_workflow(workflow_data)
        if extracted["positive"]:
            structured_prompts["positive"] = extracted["positive"]
        if extracted["negative"]:
            structured_prompts["negative"] = extracted["negative"]
        if extracted["positive"] or extracted["negative"]:
            structured_prompts["extraction_method"] = "workflow"
    
    # Fallback to prompt data for missing prompts
    if prompt_data:
        extracted = ComfyUIPromptParser.extract_prompts_from_workflow(prompt_data)
        
        # Fill in missing positive prompt
        if not structured_prompts["positive"] and extracted["positive"]:
            structured_prompts["positive"] = extracted["positive"]
            structured_prompts["extraction_method"] = "prompt" if structured_prompts["extraction_method"] == "unknown" else "mixed"
        
        # Fill in missing negative prompt  
        if not structured_prompts["negative"] and extracted["negative"]:
            structured_prompts["negative"] = extracted["negative"]
            structured_prompts["extraction_method"] = "prompt" if structured_prompts["extraction_method"] == "unknown" else "mixed"
    
    # Extract other parameters
    if prompt_data:
        structured_prompts["parameters"] = extract_generation_parameters(prompt_data)
    
    return structured_prompts


def extract_generation_parameters(prompt_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract generation parameters from prompt data"""
    parameters = {}
    
    if not isinstance(prompt_data, dict):
        return parameters
    
    # Common parameter locations in ComfyUI workflows
    for node_id, node_data in prompt_data.items():
        if not isinstance(node_data, dict):
            continue
            
        inputs = node_data.get("inputs", {})
        class_type = node_data.get("class_type", "")
        
        # Extract common parameters
        if class_type == "KSampler":
            parameters.update({
                "steps": inputs.get("steps"),
                "cfg_scale": inputs.get("cfg"),
                "sampler": inputs.get("sampler_name"),
                "scheduler": inputs.get("scheduler"),
                "seed": inputs.get("seed")
            })
        elif class_type == "CheckpointLoaderSimple":
            parameters["model"] = inputs.get("ckpt_name")
        elif class_type == "LoraLoader":
            if "loras" not in parameters:
                parameters["loras"] = []
            parameters["loras"].append({
                "name": inputs.get("lora_name"),
                "model_strength": inputs.get("strength_model"),
                "clip_strength": inputs.get("strength_clip")
            })
    
    # Clean up None values
    return {k: v for k, v in parameters.items() if v is not None}


def buildMetadata(image_path):
    if not Path(image_path).is_file():
        raise FileNotFoundError(f"File not found: {image_path}")

    img = Image.open(image_path)
    metadata = {}
    prompt = {}

    metadata["fileinfo"] = {
        "filename": Path(image_path).as_posix(),
        "resolution": f"{img.width}x{img.height}",
        "date": str(datetime.fromtimestamp(os.path.getmtime(image_path))),
        "size": str(get_size(image_path)),
    }

    # only for png files
    if isinstance(img, PngImageFile):
        metadataFromImg = img.info

        # for all metadataFromImg convert to string (but not for workflow and prompt!)
        for k, v in metadataFromImg.items():
            # from ComfyUI
            if k == "workflow":
                if isinstance(v, str): # Check if v is a string before attempting json.loads
                    try:
                        metadata["workflow"] = json.loads(v)
                    except json.JSONDecodeError as e:
                        print(f"Warning: Error parsing metadataFromImg 'workflow' as JSON, keeping as string: {e}")
                        metadata["workflow"] = v # Keep as string if parsing fails
                else:
                    metadata["workflow"] = v # If not a string, keep as is (might already be parsed)

            # from ComfyUI
            elif k == "prompt":
                if isinstance(v, str): # Check if v is a string before attempting json.loads
                    try:
                        metadata["prompt"] = json.loads(v)
                        prompt = metadata["prompt"] # extract prompt to use on metadata
                    except json.JSONDecodeError as e:
                        print(f"Warning: Error parsing metadataFromImg 'prompt' as JSON, keeping as string: {e}")
                        metadata["prompt"] = v # Keep as string if parsing fails
                else:
                    metadata["prompt"] = v # If not a string, keep as is (might already be parsed)

            else:
                if isinstance(v, str): # Check if v is a string before attempting json.loads
                    try:
                        metadata[str(k)] = json.loads(v)
                    except json.JSONDecodeError as e:
                        # print(f"Debug: Error parsing {k} as JSON, trying as string: {e}")
                        metadata[str(k)] = v # Keep as string if parsing fails
                else:
                    metadata[str(k)] = v # If not a string, keep as is

    # Enhanced prompt processing
    if prompt or metadata.get("workflow"):
        try:
            structured_prompts = extract_structured_prompts(
                prompt, 
                metadata.get("workflow", {})
            )
            metadata["structured_prompts"] = structured_prompts
        except Exception as e:
            print(f"Warning: Error extracting structured prompts: {e}")
            import traceback
            traceback.print_exc()
            metadata["structured_prompts"] = {"positive": None, "negative": None, "parameters": {}}

    if isinstance(img, JpegImageFile):
        exif = img.getexif()

        for k, v in exif.items():
            tag = TAGS.get(k, k)
            if v is not None:
                try:
                    metadata[str(tag)] = str(v)
                except Exception as e:
                    print(f"Warning: Error converting EXIF tag {tag} to string: {e}")
                    metadata[str(tag)] = "Error decoding value" # Handle encoding errors

        for ifd_id in IFD:
            try:
                if ifd_id == IFD.GPSInfo:
                    resolve = GPSTAGS
                else:
                    resolve = TAGS

                ifd = exif.get_ifd(ifd_id)
                ifd_name = str(ifd_id.name)
                metadata[ifd_name] = {}

                for k, v in ifd.items():
                    tag = resolve.get(k, k)
                    try:
                        metadata[ifd_name][str(tag)] = str(v)
                    except Exception as e:
                        print(f"Warning: Error converting EXIF IFD tag {tag} to string: {e}")
                        metadata[ifd_name][str(tag)] = "Error decoding value" # Handle encoding errors


            except KeyError:
                pass


    return img, prompt, metadata


def buildPreviewText(metadata):
    text = f"File: {metadata['fileinfo']['filename']}\n"
    text += f"Resolution: {metadata['fileinfo']['resolution']}\n"
    text += f"Date: {metadata['fileinfo']['date']}\n"
    text += f"Size: {metadata['fileinfo']['size']}\n"
    
    # Add structured prompt information if available
    if "structured_prompts" in metadata:
        prompts = metadata["structured_prompts"]
        if prompts.get("positive"):
            text += f"Positive Prompt: {prompts['positive'][:100]}...\n"
        if prompts.get("negative"):
            text += f"Negative Prompt: {prompts['negative'][:100]}...\n"
    
    return text