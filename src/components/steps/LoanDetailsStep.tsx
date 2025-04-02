
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
  
  const [formData, setFormData] = useState({
    loanType: userData.loanDetails.loanType || 'conventional',
    ltv: userData.loanDetails.ltv || 80,
    interestRate: userData.loanDetails.interestRate || null,
    propertyTax: userData.loanDetails.propertyTax || null,
    propertyInsurance: userData.loanDetails.propertyInsurance || null,
    upfrontMIP: userData.loanDetails.upfrontMIP || null,
    ongoingMIP: userData.loanDetails.ongoingMIP || null,
  });
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [apiError, setApiError] = useState(false);
  
  const downPaymentPercent = 100 - formData.ltv;
  
  const fetchExternalData = async () => {
    if (!apiKey || !userData.location.state || !userData.location.city) {
      toast.error("Location information is incomplete. Please go back and complete it.");
      return false;
    }
    
    setIsLoadingData(true);
    setApiError(false);
    
    try {
      setLoadingMessage("Fetching current interest rates...");
      setLoadingProgress(10);
      
      // Get interest rate data
      const interestRate = await getInterestRates(apiKey, userData.location.state);
      
      setLoadingProgress(40);
      setLoadingMessage("Fetching property tax information...");
      
      // Get property tax data
      const propertyTaxRate = await getPropertyTaxRate(
        apiKey, 
        userData.location.state, 
        userData.location.county || userData.location.city
      );
      
      setLoadingProgress(70);
      setLoadingMessage("Fetching insurance estimates...");
      
      // Get property insurance data
      const annualInsurance = await getPropertyInsurance(
        apiKey, 
        userData.location.state, 
        userData.location.zipCode || "00000" // Provide fallback zip code
      );
      
      setLoadingProgress(100);
      setLoadingMessage("Processing data...");
      
      console.log("API data retrieved:", {
        interestRate,
        propertyTaxRate,
        annualInsurance
      });
      
      // Update form data with fetched values
      setFormData(prev => ({
        ...prev,
        interestRate,
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
      
      toast.success("Successfully fetched mortgage data!");
      return true;
    } catch (error) {
      console.error("Error fetching data:", error);
      setApiError(true);
      toast.error("An error occurred while fetching data. Using fallback values.");
      
      // Set fallback values to ensure the user can continue
      setFormData(prev => ({
        ...prev,
        interestRate: prev.interestRate || 7.0,
        propertyTax: prev.propertyTax || 1.0,
        propertyInsurance: prev.propertyInsurance || 1200,
      }));
      
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };
  
  useEffect(() => {
    if (formData.loanType === 'fha') {
      const { upfrontMipPercent, annualMipPercent } = getFhaMipRates(
        1000, // Placeholder loan amount
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
    // Only auto-fetch if we don't have the data already
    if (!formData.interestRate || !formData.propertyTax || !formData.propertyInsurance) {
      fetchExternalData();
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If data hasn't been fetched yet, fetch it first
    if (!formData.interestRate || !formData.propertyTax || !formData.propertyInsurance) {
      await fetchExternalData();
    }
    
    // Ensure we have all required data, using fallbacks if API failed
    const dataToSave = {
      ...formData,
      interestRate: formData.interestRate || 7.0, // Default to 7% if API failed
      propertyTax: formData.propertyTax || 1.0,   // Default to 1% if API failed
      propertyInsurance: formData.propertyInsurance || 1200, // Default to $1200 if API failed
    };
    
    // Save form data
    updateLoanDetails(dataToSave);
    console.log("Moving to next step with loan details:", dataToSave);
    setCurrentStep(3);
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
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1 pt-1">
                    <li>Typically requires higher credit scores (620+)</li>
                    <li>No upfront mortgage insurance</li>
                    <li>PMI can be removed at 80% LTV</li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1 pt-1">
                    <li>More flexible credit requirements (580+)</li>
                    <li>Upfront mortgage insurance premium (MIP): {formData.upfrontMIP}%</li>
                    <li>Annual MIP: {formData.ongoingMIP}% (for the life of the loan)</li>
                  </ul>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label htmlFor="ltv">Down Payment: {downPaymentPercent}%</Label>
                <span className="text-sm font-medium">
                  LTV: {formData.ltv}%
                </span>
              </div>
              <Slider
                id="ltv"
                min={formData.loanType === 'conventional' ? 80 : 90}
                max={formData.loanType === 'conventional' ? 97 : 96.5}
                step={0.5}
                value={[formData.ltv]}
                onValueChange={(value) => setFormData({ ...formData, ltv: value[0] })}
                className="py-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formData.loanType === 'conventional' ? '20%' : '10%'} down</span>
                <span>{formData.loanType === 'conventional' ? '3%' : '3.5%'} down</span>
              </div>
            </div>
            
            {(formData.interestRate || formData.propertyTax || formData.propertyInsurance) && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium">Retrieved Data Summary</h3>
                
                {formData.interestRate && (
                  <div className="flex justify-between text-sm">
                    <span>Base Interest Rate:</span>
                    <span className="font-medium">{formData.interestRate}%</span>
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
