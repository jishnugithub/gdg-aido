import { GoogleGenerativeAI } from '@google/generative-ai';
import { JOB_CATEGORIES, type JobCategory } from '@/types';

export interface AIImageAnalysisResult {
  title: string;
  description: string;
  suggestedCategory: JobCategory;
  tags: string[];
  suggestedAmount: number;
}

/**
 * Converts a File object to a base64 string
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Format is "data:image/jpeg;base64,..."
      const split = result.split(',');
      const base64 = split[1] || '';
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Analyzes an uploaded task image using Google Gemini API to suggest
 * a structured title, description, category, tags, and suggested pricing.
 */
export async function analyzeTaskImageWithAI(file: File): Promise<AIImageAnalysisResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey || apiKey === 'your-gemini-api-key') {
    console.warn('[Gemini AI] No VITE_GEMINI_API_KEY provided. Using intelligent default suggestion.');
    return generateFallbackSuggestion(file.name);
  }

  try {
    const { base64, mimeType } = await fileToBase64(file);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const categoriesList = JOB_CATEGORIES.join(', ');

    const prompt = `You are Aidmate's AI task assistant for a hyperlocal peer-to-peer help platform ("People for People").
Analyze this image of a task/item/situation and return a JSON object ONLY, adhering strictly to this schema without markdown code blocks:
{
  "title": "A short, action-oriented task title (max 45 chars)",
  "description": "A clear, helpful 2-3 sentence task description explaining what needs to be done, any tools/effort needed, and friendly instructions for the Aidmate",
  "suggestedCategory": "One of: ${categoriesList}",
  "tags": ["tag1", "tag2", "tag3"],
  "suggestedAmount": 250
}

Ensure the suggestedCategory is EXACTLY one from the given list: ${categoriesList}.
suggestedAmount should be in Indian Rupees (₹), typically between 150 and 2000 depending on complexity.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Validate category
    let category: JobCategory = 'Other';
    if (JOB_CATEGORIES.includes(parsed.suggestedCategory as JobCategory)) {
      category = parsed.suggestedCategory as JobCategory;
    }

    return {
      title: parsed.title || 'Help with item in photo',
      description: parsed.description || 'Assistance requested for the task shown in the uploaded photo.',
      suggestedCategory: category,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['help', 'task'],
      suggestedAmount: typeof parsed.suggestedAmount === 'number' ? parsed.suggestedAmount : 300,
    };
  } catch (error) {
    console.error('[Gemini AI] Analysis error:', error);
    return generateFallbackSuggestion(file.name);
  }
}

function generateFallbackSuggestion(fileName: string): AIImageAnalysisResult {
  const lower = fileName.toLowerCase();
  
  if (lower.includes('furniture') || lower.includes('box') || lower.includes('sofa') || lower.includes('bed')) {
    return {
      title: 'Help moving and lifting heavy items',
      description: 'Need assistance with lifting and moving the furniture/items shown in the photo. Please be careful with doorways.',
      suggestedCategory: 'Moving & Lifting',
      tags: ['moving', 'lifting', 'furniture', 'heavy'],
      suggestedAmount: 500,
    };
  }

  if (lower.includes('clean') || lower.includes('mess') || lower.includes('room')) {
    return {
      title: 'Help with cleaning and organizing',
      description: 'Assistance needed to clean and organize the area shown in the photo. Basic cleaning supplies can be provided.',
      suggestedCategory: 'Cleaning',
      tags: ['cleaning', 'organizing', 'home'],
      suggestedAmount: 400,
    };
  }

  if (lower.includes('fix') || lower.includes('repair') || lower.includes('pipe') || lower.includes('leak')) {
    return {
      title: 'Repair and maintenance assistance',
      description: 'Need someone handy to help fix the issue shown in the image. Please bring basic tools if possible.',
      suggestedCategory: 'Repair & Maintenance',
      tags: ['repair', 'fixing', 'handyman', 'maintenance'],
      suggestedAmount: 450,
    };
  }

  return {
    title: 'Assistance with task shown in photo',
    description: 'Looking for a reliable nearby Aidmate to help with the task pictured here. Feel free to message with any questions.',
    suggestedCategory: 'Other',
    tags: ['help', 'local-task', 'aidmate'],
    suggestedAmount: 300,
  };
}
