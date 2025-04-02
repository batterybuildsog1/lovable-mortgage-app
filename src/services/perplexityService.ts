
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
  interestRates: {
    default: 6.75,
    states: {
      "CA": 6.8,
      "NY": 6.85,
      "TX": 6.7,
      "FL": 6.65,
      "IL": 6.73,
      "PA": 6.78,
      "OH": 6.69,
      "GA": 6.72,
      "NC": 6.67,
      "MI": 6.71
    }
  },
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

// Updated function signature to accept loanType
export const getInterestRates = async (apiKey: string, state: string, loanType: 'conventional' | 'fha'): Promise<number> => {
  try {
    // Construct query based on loan type
    const rateDescription = loanType === 'fha' 
      ? "FHA 30-year fixed mortgage rate" 
      : "Conventional 30-year fixed mortgage rate";
      
    console.log(`Fetching ${rateDescription} data for ${state} (Loan Type: ${loanType})...`);
    
    // Updated query to be more specific and request data from Mortgage News Daily
    const query = `What is today's ${rateDescription} according to Mortgage News Daily? Return only a single numeric value (percentage, including decimals) as a JSON with the key "interestRate". For example: {"interestRate": 6.875}`;
    
    const response = await fetchPerplexityData(apiKey, query);
    if (!response) {
      // Use fallback data if API fails
      console.log("Using fallback interest rate data");
      const fallbackRate = fallbackData.interestRates.states[state as keyof typeof fallbackData.interestRates.states] || 
                          fallbackData.interestRates.default;
      return fallbackRate;
    }
    
    try {
      console.log("Parsing interest rate response:", response);
      const data = JSON.parse(response.trim());
      if (typeof data.interestRate !== 'number') {
        console.error('Invalid interest rate value:', data.interestRate);
        throw new Error('Invalid interest rate value');
      }
      console.log(`Successfully parsed interest rate: ${data.interestRate}`);
      return data.interestRate;
    } catch (parseError) {
      console.error('Invalid JSON format from API for interest rate:', response);
      console.error('Parse error:', parseError);
      toast.error("Invalid data format received. Using fallback data.");
      const fallbackRate = fallbackData.interestRates.states[state as keyof typeof fallbackData.interestRates.states] || 
             fallbackData.interestRates.default;
      console.log(`Using fallback interest rate: ${fallbackRate}`);
      return fallbackRate;
    }
  } catch (error) {
    console.error('Error in getInterestRates:', error);
    toast.error("Error processing interest rate data. Using fallback data.");
    return fallbackData.interestRates.default;
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
