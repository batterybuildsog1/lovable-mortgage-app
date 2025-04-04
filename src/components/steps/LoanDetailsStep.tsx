
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMortgage } from "@/context/MortgageContext";
import { FileText, ArrowLeft, Loader2 } from "lucide-react";
import { getInterestRates, getPropertyTaxRate, getPropertyInsurance } from "@/services/perplexityService";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getFhaMipRates } from "@/utils/mortgageCalculations";
import { Progress } from "@/components/ui/progress";

interface LoanDetailsStepProps {
  apiKey: string;
}

const LoanDetailsStep: React.FC<LoanDetailsStepProps> = ({ apiKey }) => {
  const { userData, updateLoanDetails, setCurrentStep, setIsLoadingData, isLoadingData } = useMortgage();
  
  // Import the InterestRatesResult interface if it's exported from the service, or define it here
  interface InterestRatesResult {
    conventional: number | null;
    fha: number | null;
  }

  const [formData, setFormData] = useState({
    loanType: userData.loanDetails.loanType || 'conventional',
    ltv: userData.loanDetails.ltv || 80,
    // New: interestRates object
    interestRates: userData.loanDetails.interestRates || { conventional: null, fha: null }, 
    propertyTax: userData.loanDetails.propertyTax || null,
    propertyInsurance: userData.loanDetails.propertyInsurance || null,
    upfrontMIP: userData.loanDetails.upfrontMIP || null,
    ongoingMIP: userData.loanDetails.ongoingMIP || null,
  });
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [apiError, setApiError] = useState(false);
  // Removed monthlyMipPmiAmount state
  
  const downPaymentPercent = 100 - formData.ltv;
  
  const fetchExternalData = async () => {
    console.log('[LoanDetailsStep] fetchExternalData started.');
    if (!apiKey || !userData.location.state || !userData.location.city) {
      console.warn('[LoanDetailsStep] fetchExternalData: Missing location info or API key.', { hasApiKey: !!apiKey, hasState: !!userData.location.state, hasCity: !!userData.location.city });
      toast.error("Location information is incomplete. Please go back and complete it.");
      return false;
    }
    
    console.log('[LoanDetailsStep] fetchExternalData: Setting isLoadingData to true.');
    setIsLoadingData(true);
    setApiError(false);
    
    try {
      setLoadingMessage("Fetching current interest rates...");
      setLoadingProgress(10);
      
      // Get interest rate data (both rates)
      console.log('[LoanDetailsStep] fetchExternalData: Calling getInterestRates with:', { apiKey: '***', state: userData.location.state }); // Removed loanType from log
      const ratesObject = await getInterestRates(apiKey, userData.location.state); // Removed loanType argument
      console.log('[LoanDetailsStep] fetchExternalData: Received interestRates:', ratesObject);
      
      setLoadingProgress(40);
      setLoadingMessage("Fetching property tax information...");
      
      // Get property tax data
      const locationForTax = userData.location.county || userData.location.city;
      console.log('[LoanDetailsStep] fetchExternalData: Calling getPropertyTaxRate with:', { apiKey: '***', state: userData.location.state, location: locationForTax });
      const propertyTaxRate = await getPropertyTaxRate(
        apiKey, 
        userData.location.state, 
        locationForTax
      );
      console.log('[LoanDetailsStep] fetchExternalData: Received propertyTaxRate:', propertyTaxRate);
      
      setLoadingProgress(70);
      setLoadingMessage("Fetching insurance estimates...");
      
      // Get property insurance data
      const zipForInsurance = userData.location.zipCode || "00000";
      console.log('[LoanDetailsStep] fetchExternalData: Calling getPropertyInsurance with:', { apiKey: '***', state: userData.location.state, zipCode: zipForInsurance });
      const annualInsurance = await getPropertyInsurance(
        apiKey, 
        userData.location.state, 
        zipForInsurance // Provide fallback zip code
      );
      console.log('[LoanDetailsStep] fetchExternalData: Received annualInsurance:', annualInsurance);
      
      setLoadingProgress(100);
      setLoadingMessage("Processing data...");
      
      console.log("API data retrieved:", {
        interestRates: ratesObject, // Use the correct variable name
        propertyTaxRate,
        annualInsurance
      });
      
      // Update form data with fetched values
      console.log('[LoanDetailsStep] fetchExternalData: Updating formData state with fetched data.');
      setFormData(prev => ({
        ...prev,
        interestRates: ratesObject, // New: store rates object
        propertyTax: propertyTaxRate,
        propertyInsurance: annualInsurance,
      }));
      
      // If it's an FHA loan, calculate MIP
      if (formData.loanType === 'fha') {
        const { upfrontMipPercent, annualMipPercent } = getFhaMipRates(
          1000, // Placeholder loan amount, will be calculated based on actual home price later
          formData.ltv
        );
        
        setFormData(prev => ({
          ...prev,
          upfrontMIP: upfrontMipPercent,
          ongoingMIP: annualMipPercent,
        }));
      }
      
      console.log('[LoanDetailsStep] fetchExternalData: Successfully fetched and processed data.');
      toast.success("Successfully fetched mortgage data!");
      return true;
    } catch (error) {
      console.error("[LoanDetailsStep] fetchExternalData: Error caught:", error);
      setApiError(true);
      toast.error("An error occurred while fetching data. Using fallback values.");
      
      // Set fallback values to ensure the user can continue
      setFormData(prev => ({
        ...prev,
        // New: fallback rates object
        interestRates: { 
          conventional: prev.interestRates?.conventional ?? 7.0, 
          fha: prev.interestRates?.fha ?? 6.75 
        }, 
        propertyTax: prev.propertyTax || 1.0,
        propertyInsurance: prev.propertyInsurance || 1200,
      }));
      
      return false;
    } finally {
      console.log('[LoanDetailsStep] fetchExternalData: Setting isLoadingData to false.');
      setIsLoadingData(false);
    }
  };
  
  useEffect(() => {
    // Reverted: Removed estimation logic for monthly MI amount display on this page
    console.log('[LoanDetailsStep] useEffect triggered for MIP rate calculation.', { loanType: formData.loanType, ltv: formData.ltv });
    if (formData.loanType === 'fha') {
      const { upfrontMipPercent, annualMipPercent } = getFhaMipRates(
        1000, // Placeholder loan amount for rate calculation only
        formData.ltv
      );
      
      setFormData(prev => ({
        ...prev,
        upfrontMIP: upfrontMipPercent,
        ongoingMIP: annualMipPercent,
      }));
    } else {
      // For conventional loans, clear MIP values
      setFormData(prev => ({
        ...prev,
        upfrontMIP: null,
        ongoingMIP: null,
      }));
    }
  }, [formData.loanType, formData.ltv]);
  
  // Auto-fetch data on component mount if needed
  useEffect(() => {
    console.log('[LoanDetailsStep] useEffect triggered for initial data fetch check.', { 
      // New check: Check if either rate is missing
      hasRates: !!(formData.interestRates.conventional || formData.interestRates.fha), 
      hasPropertyTax: !!formData.propertyTax, 
      hasPropertyInsurance: !!formData.propertyInsurance 
    });
    // Only auto-fetch if we don't have the rates already
    if (!(formData.interestRates.conventional || formData.interestRates.fha) || !formData.propertyTax || !formData.propertyInsurance) { // New check
      console.log('[LoanDetailsStep] Initial data missing, calling fetchExternalData.');
      fetchExternalData();
    } else {
      console.log('[LoanDetailsStep] Initial data already present, skipping fetch.');
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If data hasn't been fetched yet, fetch it first
    if (!(formData.interestRates.conventional || formData.interestRates.fha) || !formData.propertyTax || !formData.propertyInsurance) { // New check
      await fetchExternalData();
    }
    
    // Ensure we have all required data, using fallbacks if API failed
    const dataToSave = {
      ...formData,
      // New: Ensure rates object has fallbacks if needed
      interestRates: {
        conventional: formData.interestRates?.conventional ?? 7.0,
        fha: formData.interestRates?.fha ?? 6.75,
      },
      propertyTax: formData.propertyTax || 1.0,   
      propertyInsurance: formData.propertyInsurance || 1200, 
    };
    
    // Save form data
    console.log('[LoanDetailsStep] handleSubmit: Calling updateLoanDetails with:', dataToSave);
    updateLoanDetails(dataToSave);
    console.log('[LoanDetailsStep] handleSubmit: Calling setCurrentStep(3)'); // Corrected step to 3 (ResultsStep)
    setCurrentStep(3); // Advance to the next step (Results)
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Loan Details
        </CardTitle>
        <CardDescription>
          Select your preferred loan type and down payment amount.
        </CardDescription>
      </CardHeader>
      
      {isLoadingData ? (
        <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-center font-medium">{loadingMessage}</p>
          <Progress value={loadingProgress} className="w-full" />
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {apiError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
                <p>There were issues fetching the latest data. We've provided some default values so you can continue.</p>
              </div>
            )}
            
            <div className="space-y-3">
              <Label>Loan Type</Label>
              <RadioGroup
                value={formData.loanType}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  loanType: value as 'conventional' | 'fha' 
                })}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem 
                    value="conventional" 
                    id="conventional" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="conventional"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="font-semibold">Conventional</span>
                    <span className="text-sm text-muted-foreground">3-20% Down</span>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem 
                    value="fha" 
                    id="fha" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="fha"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="font-semibold">FHA</span>
                    <span className="text-sm text-muted-foreground">3.5-10% Down</span>
                  </Label>
                </div>
              </RadioGroup>
              
              <div className="text-sm pt-2">
                <p className="font-medium">Selected Option Features:</p>
                {formData.loanType === 'conventional' ? (
                  // Conventional Features
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1 pt-1">
                    <li>Typically requires higher credit scores (620+)</li>
                    <li>No upfront mortgage insurance</li>
                    {formData.ltv > 80 ? (
                      <li>PMI required until ~80% LTV</li>
                    ) : (
                      <li>No PMI required</li>
                    )}
                  </ul>
                ) : (
                  // FHA Features
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1 pt-1">
                    <li>More flexible credit requirements (580+)</li>
                    <li>Upfront mortgage insurance premium (MIP): {formData.upfrontMIP}%</li>
                    <li>Annual MIP Rate: {formData.ongoingMIP}% (for the life of the loan)</li>
                  </ul>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {/* Use aria-labelledby approach */}
              <div className="flex justify-between">
                {/* Give the label text an ID, remove htmlFor from Label component */}
                <Label id="ltv-label">Down Payment: {downPaymentPercent}%</Label> 
                <span className="text-sm font-medium">LTV: {formData.ltv}%</span>
              </div>
              <Slider
                id="ltv" // Keep id for potential other uses, but aria-labelledby is primary now
                aria-labelledby="ltv-label" // Add aria-labelledby pointing to the label's ID
                min={formData.loanType === 'conventional' ? 80 : 90}
                max={formData.loanType === 'conventional' ? 97 : 96.5}
                  step={0.5}
                  value={[formData.ltv]}
                  onValueChange={(value) => setFormData({ ...formData, ltv: value[0] })}
                  className="py-4"
              />
              {/* Removed the nested structure */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formData.loanType === 'conventional' ? '20%' : '10%'} down</span>
                <span>{formData.loanType === 'conventional' ? '3%' : '3.5%'} down</span>
              </div>
            </div>
            
            {/* New check: Check if rates object exists */}
            {(formData.interestRates.conventional || formData.interestRates.fha || formData.propertyTax || formData.propertyInsurance) && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium">Retrieved Data Summary</h3>
                
                {/* New display logic: Show rate for selected loan type */}
                {formData.interestRates[formData.loanType] && (
                  <div className="flex justify-between text-sm">
                    <span>Base Interest Rate ({formData.loanType === 'conventional' ? 'Conv.' : 'FHA'}):</span>
                    <span className="font-medium">{formData.interestRates[formData.loanType]}%</span> 
                  </div>
                )}
                
                {formData.propertyTax && (
                  <div className="flex justify-between text-sm">
                    <span>Property Tax Rate:</span>
                    <span className="font-medium">{formData.propertyTax}%</span>
                  </div>
                )}
                
                {formData.propertyInsurance && (
                  <div className="flex justify-between text-sm">
                    <span>Annual Insurance Estimate:</span>
                    <span className="font-medium">${formData.propertyInsurance.toLocaleString()}</span>
                  </div>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={fetchExternalData}
                >
                  Refresh Data
                </Button>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="submit">
              Continue
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
};

export default LoanDetailsStep;
