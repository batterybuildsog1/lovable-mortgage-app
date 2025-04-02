

import { toast } from "sonner";

// Hard-coded API key for demo purposes
const DEMO_API_KEY = "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";

interface PerplexityResponse {
  id: string;
  choices: {
    message: {
      content: string;
    }
  }[];
}

// Fallback data in case API fails
const fallbackData = {
  // Updated fallback structure for both rates
  interestRates: {
    conventional: 7.0, 
    fha: 6.75,
    // State-specific fallbacks could be added here if needed, 
    // but using general defaults for now.
  },
  // Removed the first, incorrect propertyTaxRates object above this line
  propertyTaxRates: {
    default: 1.07,
    states: {
      "CA": 0.76,
      "NY": 1.72,
      "TX": 1.8,
      "FL": 0.89,
      "IL": 2.27,
      "PA": 1.58,
      "OH": 1.62,
      "GA": 0.92,
      "NC": 0.84,
      "MI": 1.54
    }
  },
  annualInsurance: {
    default: 1200,
    states: {
      "CA": 1450,
      "NY": 1350,
      "TX": 1850,
      "FL": 1950,
      "IL": 1150,
      "PA": 1050,
      "OH": 950,
      "GA": 1250,
      "NC": 1150,
      "MI": 1050
    }
  }
};

export const fetchPerplexityData = async (
  apiKey: string,
  query: string
): Promise<string | null> => {
  try {
    console.log("Attempting Perplexity API request...");
    
    // Use provided API key or fallback to demo key
    const keyToUse = apiKey || DEMO_API_KEY;
    
    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout (increased from 15s)
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyToUse}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant specializing in real estate and mortgage data. Provide accurate, current data in JSON format only. No explanations or additional text.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1, // Lower temperature for more consistent responses
        max_tokens: 1000,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`API Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API returned status: ${response.status}, Error: ${errorText}`);
      throw new Error(`Error fetching data: ${response.statusText}`);
    }

    const data = await response.json() as PerplexityResponse;
    console.log("API response received:", data);
    
    // Check if we have valid data in the expected format
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format from Perplexity API:', data);
      throw new Error('Invalid API response format');
    }
    
    const content = data.choices[0].message.content;
    console.log("Extracted content:", content);
    
    return content;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error('Perplexity API request timed out');
      toast.error("API request timed out. Using fallback data.");
    } else {
      console.error('Perplexity API error:', error);
      toast.error("API request failed. Using fallback data.");
    }
    return null;
  }
};

// Define the return type for the interest rates object
interface InterestRatesResult {
  conventional: number | null;
  fha: number | null;
}

// Updated function signature: Removed loanType, returns an object with both rates
export const getInterestRates = async (apiKey: string, state: string): Promise<InterestRatesResult> => {
  const fallbackRates: InterestRatesResult = {
    conventional: fallbackData.interestRates.conventional,
    fha: fallbackData.interestRates.fha,
  };

  try {
    console.log(`Fetching Conventional and FHA 30-year fixed rates for ${state}...`);
    
    // Updated query to ask for both rates in one JSON object
    const query = `What are today's Conventional 30-year fixed mortgage rate AND FHA 30-year fixed mortgage rate according to Mortgage News Daily? Return only numeric values (percentage, including decimals) in a JSON object with keys 'conventionalRate' and 'fhaRate'. For example: {"conventionalRate": 7.125, "fhaRate": 6.875}`;
    
    const response = await fetchPerplexityData(apiKey, query);
    
    if (!response) {
      console.log("API failed, using fallback interest rates.");
      return fallbackRates;
    }
    
    try {
      console.log("Parsing interest rates response:", response);
      // Attempt to clean potential markdown code block fences
      const cleanedResponse = response.trim().replace(/^```json\s*|\s*```$/g, '');
      const data = JSON.parse(cleanedResponse);
      
      // Validate the structure and types
      const conventionalRate = typeof data.conventionalRate === 'number' ? data.conventionalRate : null;
      const fhaRate = typeof data.fhaRate === 'number' ? data.fhaRate : null;

      if (conventionalRate === null || fhaRate === null) {
         console.warn('API response missing one or both rates, using fallbacks where necessary.', data);
         // Return fetched rates if available, otherwise use fallback
         return {
           conventional: conventionalRate ?? fallbackRates.conventional,
           fha: fhaRate ?? fallbackRates.fha,
         };
      }

      console.log(`Successfully parsed rates: Conventional=${conventionalRate}, FHA=${fhaRate}`);
      return { conventional: conventionalRate, fha: fhaRate };
      
    } catch (parseError) {
      console.error('Invalid JSON format from API for interest rates:', response);
      console.error('Parse error:', parseError);
      toast.error("Invalid data format for rates. Using fallback data.");
      return fallbackRates;
    }
  } catch (error) {
    console.error('Error in getInterestRates:', error);
    toast.error("Error processing interest rate data. Using fallback data.");
    return fallbackRates;
  }
};

export const getPropertyTaxRate = async (apiKey: string, state: string, county: string): Promise<number> => {
  try {
    console.log(`Fetching property tax data for ${county}, ${state}...`);
    const query = `What is the average property tax rate in ${county}, ${state}? Return only a single numeric value (percentage) as a JSON with the key "propertyTaxRate". For example: {"propertyTaxRate": 1.2}`;
    
    const response = await fetchPerplexityData(apiKey, query);
    if (!response) {
      // Use fallback data if API fails
      console.log("Using fallback property tax data");
      const fallbackRate = fallbackData.propertyTaxRates.states[state as keyof typeof fallbackData.propertyTaxRates.states] || 
                          fallbackData.propertyTaxRates.default;
      return fallbackRate;
    }
    
    try {
      console.log("Parsing property tax response:", response);
      const data = JSON.parse(response.trim());
      if (typeof data.propertyTaxRate !== 'number') {
        console.error('Invalid property tax rate value:', data.propertyTaxRate);
        throw new Error('Invalid property tax rate value');
      }
      console.log(`Successfully parsed property tax rate: ${data.propertyTaxRate}`);
      return data.propertyTaxRate;
    } catch (parseError) {
      console.error('Invalid JSON format from API for property tax:', response);
      console.error('Parse error:', parseError);
      toast.error("Invalid data format received. Using fallback data.");
      const fallbackRate = fallbackData.propertyTaxRates.states[state as keyof typeof fallbackData.propertyTaxRates.states] || 
             fallbackData.propertyTaxRates.default;
      console.log(`Using fallback property tax rate: ${fallbackRate}`);
      return fallbackRate;
    }
  } catch (error) {
    console.error('Error in getPropertyTaxRate:', error);
    toast.error("Error processing property tax data. Using fallback data.");
    return fallbackData.propertyTaxRates.default;
  }
};

export const getPropertyInsurance = async (apiKey: string, state: string, zipCode: string): Promise<number> => {
  try {
    console.log(`Fetching insurance data for ${zipCode} (${state})...`);
    const query = `What is the average annual home insurance premium for a single-family home in ${zipCode} (${state})? Return only a single numeric value (annual dollar amount) as a JSON with the key "annualInsurance". For example: {"annualInsurance": 1200}`;
    
    const response = await fetchPerplexityData(apiKey, query);
    if (!response) {
      // Use fallback data if API fails
      console.log("Using fallback insurance data");
      const fallbackRate = fallbackData.annualInsurance.states[state as keyof typeof fallbackData.annualInsurance.states] || 
                          fallbackData.annualInsurance.default;
      return fallbackRate;
    }
    
    try {
      console.log("Parsing insurance response:", response);
      const data = JSON.parse(response.trim());
      if (typeof data.annualInsurance !== 'number') {
        console.error('Invalid insurance value:', data.annualInsurance);
        throw new Error('Invalid insurance value');
      }
      console.log(`Successfully parsed insurance amount: ${data.annualInsurance}`);
      return data.annualInsurance;
    } catch (parseError) {
      console.error('Invalid JSON format from API for insurance:', response);
      console.error('Parse error:', parseError);
      toast.error("Invalid data format received. Using fallback data.");
      const fallbackRate = fallbackData.annualInsurance.states[state as keyof typeof fallbackData.annualInsurance.states] || 
             fallbackData.annualInsurance.default;
      console.log(`Using fallback insurance amount: ${fallbackRate}`);
      return fallbackRate;
    }
  } catch (error) {
    console.error('Error in getPropertyInsurance:', error);
    toast.error("Error processing insurance data. Using fallback data.");
    return fallbackData.annualInsurance.default;
  }
};
