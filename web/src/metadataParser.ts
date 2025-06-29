/* eslint-disable @typescript-eslint/no-explicit-any */
// Utility to parse and format metadata for the Gallery preview
import type { FileDetails } from './types';

export function parseMetadata(details: FileDetails) {
    if (!details || !details.metadata) return {};
    const { metadata } = details;
    const fileinfo = metadata.fileinfo || {};
    
    // Use structured prompts if available (from enhanced backend)
    const structured = metadata.structured_prompts;
    if (structured) {
        return {
            Filename: fileinfo.filename || details.name,
            Resolution: fileinfo.resolution,
            'File Size': fileinfo.size,
            'Date Created': fileinfo.date || details.date,
            'Positive Prompt': structured.positive,
            'Negative Prompt': structured.negative,
            Model: structured.parameters?.model,
            Sampler: structured.parameters?.sampler,
            Scheduler: structured.parameters?.scheduler,
            Steps: structured.parameters?.steps,
            'CFG Scale': structured.parameters?.cfg_scale,
            Seed: structured.parameters?.seed,
            LoRAs: structured.parameters?.loras ? formatLoRAs(structured.parameters.loras) : null,
            'Extraction Method': structured.extraction_method,
        };
    }
    
    // Fallback to legacy parsing
    const prompt = metadata.prompt || {};
    return {
        Filename: fileinfo.filename || details.name,
        Resolution: fileinfo.resolution,
        'File Size': fileinfo.size,
        'Date Created': fileinfo.date || details.date,
        Model: prompt.model,
        'Positive Prompt': prompt.positive,
        'Negative Prompt': prompt.negative,
        Sampler: prompt.sampler,
        Scheduler: prompt.scheduler,
        Steps: prompt.steps,
        'CFG Scale': prompt.cfg_scale,
        Seed: prompt.seed,
        LoRAs: prompt.loras,
    };
}

function formatLoRAs(loras: any[]): string {
    if (!Array.isArray(loras) || loras.length === 0) return 'N/A';
    
    return loras.map(lora => {
        if (typeof lora === 'object' && lora && 'name' in lora) {
            const modelStr = lora.model_strength ?? lora.strength ?? 'N/A';
            const clipStr = lora.clip_strength ?? 'N/A';
            return `${lora.name} (Model: ${modelStr}, Clip: ${clipStr})`;
        }
        return String(lora);
    }).join(', ');
}

// Enhanced ComfyUI metadata parser with structured prompt support
export function parseComfyMetadata(metadata: Record<string, any>): Record<string, string> {
    if (!metadata) return {};
    
    const result: Record<string, string> = {};
    
    // File info
    const fileinfo: Record<string, any> = metadata.fileinfo || {};
    result["Filename"] = fileinfo.filename || '';
    result["Resolution"] = fileinfo.resolution || '';
    result["File Size"] = fileinfo.size || '';
    result["Date Created"] = fileinfo.date || '';

    // Use structured prompts if available (preferred method)
    if (metadata.structured_prompts) {
        const structured = metadata.structured_prompts;
        
        result["Positive Prompt"] = structured.positive || '';
        result["Negative Prompt"] = structured.negative || '';
        result["Extraction Method"] = structured.extraction_method || 'unknown';
        
        // Add parameters from structured data
        if (structured.parameters) {
            const params = structured.parameters;
            result["Model"] = params.model || '';
            result["Sampler"] = params.sampler || '';
            result["Scheduler"] = params.scheduler || '';
            result["Steps"] = params.steps ? String(params.steps) : '';
            result["CFG Scale"] = params.cfg_scale ? String(params.cfg_scale) : '';
            result["Seed"] = params.seed ? String(params.seed) : '';
            result["LoRAs"] = params.loras ? formatLoRAs(params.loras) : 'N/A';
        }
        
        return result;
    }
    
    // Fallback to legacy parsing for backwards compatibility
    return parseLegacyComfyMetadata(metadata, result);
}

// Legacy parsing function (simplified from original)
function parseLegacyComfyMetadata(metadata: Record<string, any>, result: Record<string, string>): Record<string, string> {
    // Defensive parse for workflow/prompt JSON strings
    let prompt: Record<string, any> | undefined = metadata.prompt;
    let workflow: Record<string, any> | undefined = metadata.workflow;
    
    try { if (typeof prompt === 'string') prompt = JSON.parse(prompt); } catch { /* ignore parse errors */ }
    try { if (typeof workflow === 'string') workflow = JSON.parse(workflow); } catch { /* ignore parse errors */ }

    // Quick extraction from common node IDs (basic workflows)
    if (prompt && typeof prompt === 'object') {
        result["Model"] = prompt?.['1']?.inputs?.ckpt_name || '';
        result["Positive Prompt"] = prompt?.['2']?.inputs?.text || prompt?.['7']?.inputs?.text || '';
        result["Negative Prompt"] = prompt?.['3']?.inputs?.text || prompt?.['8']?.inputs?.text || '';
        result["Sampler"] = prompt?.['10']?.inputs?.sampler_name || '';
        result["Scheduler"] = prompt?.['10']?.inputs?.scheduler || '';
        result["Steps"] = prompt?.['10']?.inputs?.steps || '';
        result["CFG Scale"] = prompt?.['10']?.inputs?.cfg || '';
        result["Seed"] = prompt?.['10']?.inputs?.seed || '';
        
        // Extract LoRAs
        const loras: string[] = [];
        for (const key in prompt) {
            if (prompt[key]?.class_type === 'LoraLoader') {
                loras.push(prompt[key].inputs.lora_name);
            }
        }
        result["LoRAs"] = loras.length > 0 ? loras.join(', ') : 'N/A';
    }
    
    // Try workflow extraction if prompt didn't yield results
    if ((!result["Positive Prompt"] || !result["Negative Prompt"]) && workflow) {
        const workflowExtracted = extractFromWorkflow(workflow);
        if (workflowExtracted["Positive Prompt"]) result["Positive Prompt"] = workflowExtracted["Positive Prompt"];
        if (workflowExtracted["Negative Prompt"]) result["Negative Prompt"] = workflowExtracted["Negative Prompt"];
    }
    
    result["Extraction Method"] = 'legacy';
    return result;
}

// Simplified workflow extraction for fallback cases
function extractFromWorkflow(workflow: any): Record<string, string> {
    const result: Record<string, string> = {"Positive Prompt": "", "Negative Prompt": ""};
    
    if (!workflow || typeof workflow !== 'object') return result;
    
    // Handle nodes array
    if (workflow.nodes && Array.isArray(workflow.nodes)) {
        for (const node of workflow.nodes) {
            if (!node || typeof node !== 'object') continue;
            
            const title = (node.title || '').toLowerCase();
            const widgets_values = node.widgets_values || [];
            
            if (title.includes('positive') && title.includes('prompt') && widgets_values[0]) {
                result["Positive Prompt"] = String(widgets_values[0]);
            } else if (title.includes('negative') && title.includes('prompt') && widgets_values[0]) {
                result["Negative Prompt"] = String(widgets_values[0]);
            }
        }
    }
    
    return result;
}
