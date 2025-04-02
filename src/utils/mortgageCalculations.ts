
// FHA MIP rates for different scenarios
const FHA_UPFRONT_MIP = 1.75; // 1.75% of loan amount
const FHA_ANNUAL_MIP: Record<string, number> = {
  "below15Years_below90LTV": 0.45, // 0.45% annual
  "below15Years_above90LTV": 0.70, // 0.70% annual
  "above15Years_below90LTV": 0.50, // 0.50% annual 
  "above15Years_above90LTV": 0.55, // 0.55% annual
};

// DTI limits based on FICO score and loan type
const DTI_LIMITS = {
  conventional: {
    default: 36,
    strongFactors: {
      highFICO: 45,
      reserves: 45,
      lowLTV: 45
    }
  },
  fha: {
    default: 43,
    strongFactors: {
      highFICO: 50,
      reserves: 50,
      compensatingFactors: 50
    }
  }
};

// Base rates adjustment based on FICO score
const FICO_RATE_ADJUSTMENTS = {
  "conventional": {
    "740+": 0,
    "720-739": 0.125,
    "700-719": 0.25, 
    "680-699": 0.375,
    "660-679": 0.5,
    "640-659": 0.75,
    "620-639": 1.0
  },
  "fha": {
    "740+": 0,
    "720-739": 0,
    "700-719": 0.125,
    "680-699": 0.25,
    "660-679": 0.25,
    "640-659": 0.25,
    "620-639": 0.25,
    "580-619": 0.5,
    "500-579": 0.75
  }
};

// LTV adjustments
const LTV_RATE_ADJUSTMENTS: Record<string, number> = {
  "below60": -0.25,
  "60-70": -0.125,
  "70-75": 0,
  "75-80": 0,
  "80-85": 0.125,
  "85-90": 0.25, 
  "90-95": 0.375,
  "95-97": 0.5,
  "above97": 0.75
};

export const getFicoRateAdjustment = (
  ficoScore: number, 
  loanType: 'conventional' | 'fha'
): number => {
  const adjustments = FICO_RATE_ADJUSTMENTS[loanType];
  
  if (ficoScore >= 740) return adjustments["740+"];
  if (ficoScore >= 720) return adjustments["720-739"];
  if (ficoScore >= 700) return adjustments["700-719"];
  if (ficoScore >= 680) return adjustments["680-699"];
  if (ficoScore >= 660) return adjustments["660-679"];
  if (ficoScore >= 640) return adjustments["640-659"];
  if (ficoScore >= 620) return adjustments["620-639"];
  
  // Only applicable for FHA
  if (loanType === "fha") {
    if (ficoScore >= 580) return adjustments["580-619"];
    if (ficoScore >= 500) return adjustments["500-579"];
  }
  
  return loanType === 'conventional' ? 999 : adjustments["500-579"]; // Conventional loans typically not available below 620
};

export const getLtvRateAdjustment = (ltv: number): number => {
  if (ltv < 60) return LTV_RATE_ADJUSTMENTS["below60"];
  if (ltv < 70) return LTV_RATE_ADJUSTMENTS["60-70"];
  if (ltv < 75) return LTV_RATE_ADJUSTMENTS["70-75"];
  if (ltv < 80) return LTV_RATE_ADJUSTMENTS["75-80"];
  if (ltv < 85) return LTV_RATE_ADJUSTMENTS["80-85"];
  if (ltv < 90) return LTV_RATE_ADJUSTMENTS["85-90"];
  if (ltv < 95) return LTV_RATE_ADJUSTMENTS["90-95"];
  if (ltv <= 97) return LTV_RATE_ADJUSTMENTS["95-97"];
  return LTV_RATE_ADJUSTMENTS["above97"];
};

// Define the interest rates object type (matching the one in context/service)
interface InterestRatesObject {
  conventional: number | null;
  fha: number | null;
}

export const calculateAdjustedRate = (
  interestRates: InterestRatesObject, // New: takes the rates object
  ficoScore: number,
  ltv: number,
  loanType: 'conventional' | 'fha'
): number => {
  // Select the base rate based on loan type
  const baseRate = interestRates[loanType]; 
  
  // Handle case where the specific rate might be null (e.g., API failure)
  if (baseRate === null) {
    console.warn(`Base interest rate for ${loanType} is null. Using fallback logic or default.`);
    // Return a default/fallback rate or handle error appropriately. 
    // For now, let's return a high default to indicate an issue, 
    // though ideally, this case is handled before calling this function.
    return 99; // Or use fallbackData.interestRates[loanType] if defined appropriately
  }

  const ficoAdjustment = getFicoRateAdjustment(ficoScore, loanType);
  const ltvAdjustment = getLtvRateAdjustment(ltv);
  
  // Ensure adjustments don't make rate negative, though unlikely with current values
  const adjusted = baseRate + ficoAdjustment + ltvAdjustment;
  return Math.max(adjusted, 0.1); // Prevent rate from being <= 0
};

export const calculateMaxDTI = (
  ficoScore: number,
  ltv: number,
  loanType: 'conventional' | 'fha',
  mitigatingFactors: string[]
): number => {
  const dtiLimits = DTI_LIMITS[loanType];
  let maxDTI = dtiLimits.default;

  // Check for strong mitigating factors
  if (loanType === 'conventional') {
    if (ficoScore >= 720) maxDTI = dtiLimits.strongFactors.highFICO;
    if (mitigatingFactors.includes('reserves')) {
      maxDTI = Math.max(maxDTI, dtiLimits.strongFactors.reserves);
    }
    if (ltv <= 75) {
      // For conventional loans, we need to cast to access the lowLTV property
      const conventionalFactors = dtiLimits.strongFactors as typeof DTI_LIMITS.conventional.strongFactors;
      maxDTI = Math.max(maxDTI, conventionalFactors.lowLTV);
    }
  } else { // FHA
    if (ficoScore >= 680) maxDTI = dtiLimits.strongFactors.highFICO;
    if (mitigatingFactors.includes('reserves')) {
      maxDTI = Math.max(maxDTI, dtiLimits.strongFactors.reserves);
    }
    if (mitigatingFactors.length >= 2) {
      // For FHA loans, we need to cast to access the compensatingFactors property
      const fhaFactors = dtiLimits.strongFactors as typeof DTI_LIMITS.fha.strongFactors;
      maxDTI = Math.max(maxDTI, fhaFactors.compensatingFactors);
    }
  }

  return maxDTI;
};

export const calculateMonthlyPayment = (
  loanAmount: number,
  interestRate: number,
  termYears: number = 30,
  propertyTax: number = 0,
  propertyInsurance: number = 0,
  pmi: number = 0
): number => {
  // Convert annual interest rate to monthly and decimal
  const monthlyRate = interestRate / 100 / 12;
  const totalPayments = termYears * 12;
  
  // Calculate principal and interest payment
  let monthlyPrincipalAndInterest = 0;
  if (monthlyRate === 0) {
    // Edge case: 0% interest rate
    monthlyPrincipalAndInterest = loanAmount / totalPayments;
  } else {
    // Standard formula: P × r × (1 + r)^n / ((1 + r)^n - 1)
    monthlyPrincipalAndInterest = loanAmount * 
      (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
      (Math.pow(1 + monthlyRate, totalPayments) - 1);
  }
  
  // Monthly components
  const monthlyPropertyTax = propertyTax / 12;
  const monthlyInsurance = propertyInsurance / 12;
  const monthlyPMI = (pmi / 100) * loanAmount / 12;
  
  // Total monthly payment
  const totalMonthlyPayment = monthlyPrincipalAndInterest + monthlyPropertyTax + monthlyInsurance + monthlyPMI;
  
  return Math.round(totalMonthlyPayment);
};

export const calculateMaxPurchasePrice = (
  annualIncome: number,
  monthlyDebts: number,
  dti: number,
  interestRate: number,
  propertyTaxRate: number,
  annualInsurance: number,
  downPaymentPercent: number,
  pmiRate: number = 0,
  termYears: number = 30
): number => {
  // Maximum monthly housing payment
  const maxMonthlyPayment = (annualIncome / 12) * (dti / 100) - monthlyDebts;
  
  // Monthly fixed costs (taxes and insurance) as percentage of home price
  const monthlyPropertyTaxRate = (propertyTaxRate / 100) / 12;
  const monthlyInsuranceRate = annualInsurance / 12;
  
  // Monthly PMI as percentage of loan amount (which is a percentage of home price)
  const loanToValueRatio = 1 - (downPaymentPercent / 100);
  const effectivePmiRate = (pmiRate / 100) * loanToValueRatio / 12;
  
  // Convert annual interest rate to monthly and decimal
  const monthlyRate = interestRate / 100 / 12;
  const totalPayments = termYears * 12;
  
  // Home price multiplier for PI payment
  let piMultiplier;
  if (monthlyRate === 0) {
    piMultiplier = 1 / (totalPayments * loanToValueRatio);
  } else {
    piMultiplier = (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
                 ((Math.pow(1 + monthlyRate, totalPayments) - 1) * loanToValueRatio);
  }
  
  // Total home price to payment ratio
  const totalMultiplier = piMultiplier + monthlyPropertyTaxRate + effectivePmiRate;
  
  // Maximum home price
  const maxHomePrice = (maxMonthlyPayment - monthlyInsuranceRate) / totalMultiplier;
  
  return Math.floor(maxHomePrice);
};

export const getFhaMipRates = (
  loanAmount: number,
  ltv: number,
  termYears: number = 30
): { upfrontMipPercent: number; annualMipPercent: number } => {
  // Upfront MIP is always 1.75% for FHA loans
  const upfrontMipPercent = FHA_UPFRONT_MIP;
  
  // Annual MIP depends on loan term and LTV
  let annualMipPercent;
  if (termYears <= 15) {
    annualMipPercent = ltv <= 90 
      ? FHA_ANNUAL_MIP["below15Years_below90LTV"] 
      : FHA_ANNUAL_MIP["below15Years_above90LTV"];
  } else {
    annualMipPercent = ltv <= 90 
      ? FHA_ANNUAL_MIP["above15Years_below90LTV"] 
      : FHA_ANNUAL_MIP["above15Years_above90LTV"];
  }
  
  return { upfrontMipPercent, annualMipPercent };
};

export const getNextFicoBand = (
  currentFico: number, 
  loanType: 'conventional' | 'fha'
): number | null => {
  if (loanType === 'conventional') {
    if (currentFico < 620) return 620;
    if (currentFico < 640) return 640;
    if (currentFico < 660) return 660;
    if (currentFico < 680) return 680;
    if (currentFico < 700) return 700;
    if (currentFico < 720) return 720;
    if (currentFico < 740) return 740;
    return null; // Already at highest band
  } else { // FHA
    if (currentFico < 500) return null; // Below minimum FHA
    if (currentFico < 580) return 580;
    if (currentFico < 620) return 620;
    if (currentFico < 640) return 640;
    if (currentFico < 660) return 660;
    if (currentFico < 680) return 680;
    if (currentFico < 700) return 700;
    if (currentFico < 720) return 720;
    if (currentFico < 740) return 740;
    return null; // Already at highest band
  }
};

export const getLowerLtvOption = (currentLtv: number): number | null => {
  if (currentLtv > 97) return 97;
  if (currentLtv > 95) return 95;
  if (currentLtv > 90) return 90;
  if (currentLtv > 85) return 85;
  if (currentLtv > 80) return 80;
  if (currentLtv > 75) return 75;
  if (currentLtv > 70) return 70;
  if (currentLtv > 60) return 60;
  return null; // Already at lowest band
};
