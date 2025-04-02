import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMortgage } from "@/context/MortgageContext";
import { Home, ArrowLeft, TrendingUp, ArrowRightCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { 
  calculateAdjustedRate, 
  calculateMaxDTI, 
  calculateMaxPurchasePrice,
  calculateMonthlyPayment,
  getNextFicoBand,
  getLowerLtvOption,
  getFhaMipRates
} from "@/utils/mortgageCalculations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ResultsStep: React.FC = () => {
  const { userData, updateResults, setCurrentStep } = useMortgage();
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentTab, setCurrentTab] = useState("primary");
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const validateData = () => {
    const { financials, loanDetails, location } = userData;
    
    if (!location.city || !location.state || !location.zipCode) {
      setValidationError("Please complete your location information in Step 1.");
      return false;
    }
    
    if (!financials.annualIncome || financials.annualIncome <= 0) {
      setValidationError("Please enter your annual income in Step 2.");
      return false;
    }
    
    if (!loanDetails.interestRate || loanDetails.interestRate <= 0) {
      setValidationError("Required loan details are missing. Please complete Step 3.");
      return false;
    }
    
    if (!loanDetails.propertyTax || loanDetails.propertyTax <= 0) {
      setValidationError("Property tax information is missing. Please complete Step 3.");
      return false;
    }
    
    setValidationError(null);
    return true;
  };
  
  const calculateResults = async () => {
    setIsCalculating(true);
    
    try {
      // First validate all required data
      if (!validateData()) {
        setIsCalculating(false);
        return;
      }
      
      // Enhanced validation for required data
      const { financials, loanDetails } = userData;
      
      // Calculate the max DTI based on FICO score, LTV, and mitigating factors
      const maxDTI = calculateMaxDTI(
        financials.ficoScore,
        loanDetails.ltv,
        loanDetails.loanType,
        financials.mitigatingFactors
      );
      
      // Calculate the adjusted interest rate based on FICO and LTV
      const adjustedRate = calculateAdjustedRate(
        loanDetails.interestRate,
        financials.ficoScore,
        loanDetails.ltv,
        loanDetails.loanType
      );
      
      // Get MIP/PMI rate (for now simplified)
      let pmiRate = 0;
      if (loanDetails.loanType === 'fha' && loanDetails.ongoingMIP) {
        pmiRate = loanDetails.ongoingMIP;
      } else if (loanDetails.ltv > 80) {
        // Simple PMI estimate based on LTV for conventional loans
        pmiRate = loanDetails.ltv > 95 ? 1.1 : 
                  loanDetails.ltv > 90 ? 0.8 : 
                  loanDetails.ltv > 85 ? 0.5 : 0.3;
      }
      
      // Calculate max purchase price
      const maxPurchasePrice = calculateMaxPurchasePrice(
        financials.annualIncome,
        financials.monthlyDebts,
        maxDTI,
        adjustedRate,
        loanDetails.propertyTax,
        loanDetails.propertyInsurance || 1200, // Default to $1200 if not available
        100 - loanDetails.ltv, // Convert LTV to down payment %
        pmiRate
      );
      
      // Calculate loan amount
      const loanAmount = maxPurchasePrice * (loanDetails.ltv / 100);
      
      // Calculate monthly payment
      const monthlyPayment = calculateMonthlyPayment(
        loanAmount,
        adjustedRate,
        30, // 30-year term
        (loanDetails.propertyTax / 100) * maxPurchasePrice, // Annual property tax
        loanDetails.propertyInsurance || 1200, // Annual insurance
        pmiRate // PMI/MIP rate
      );
      
      // Generate alternative scenarios
      const scenarios = [];
      
      // Scenario 1: Switch loan type
      const alternativeLoanType = loanDetails.loanType === 'conventional' ? 'fha' : 'conventional';
      
      // Calculate for alternative loan type
      const altDTI = calculateMaxDTI(
        financials.ficoScore,
        loanDetails.ltv,
        alternativeLoanType,
        financials.mitigatingFactors
      );
      
      const altRate = calculateAdjustedRate(
        loanDetails.interestRate,
        financials.ficoScore,
        loanDetails.ltv,
        alternativeLoanType
      );
      
      // Get alternative MIP/PMI rate
      let altPmiRate = 0;
      if (alternativeLoanType === 'fha') {
        const mipRates = getFhaMipRates(loanAmount, loanDetails.ltv);
        altPmiRate = mipRates.annualMipPercent;
      } else if (loanDetails.ltv > 80) {
        // Simple PMI estimate for conventional
        altPmiRate = loanDetails.ltv > 95 ? 1.1 : 
                    loanDetails.ltv > 90 ? 0.8 : 
                    loanDetails.ltv > 85 ? 0.5 : 0.3;
      }
      
      const altMaxPrice = calculateMaxPurchasePrice(
        financials.annualIncome,
        financials.monthlyDebts,
        altDTI,
        altRate,
        loanDetails.propertyTax,
        loanDetails.propertyInsurance || 1200,
        100 - loanDetails.ltv,
        altPmiRate
      );
      
      const altLoanAmount = altMaxPrice * (loanDetails.ltv / 100);
      
      const altMonthlyPayment = calculateMonthlyPayment(
        altLoanAmount,
        altRate,
        30,
        (loanDetails.propertyTax / 100) * altMaxPrice,
        loanDetails.propertyInsurance || 1200,
        altPmiRate
      );
      
      scenarios.push({
        loanType: alternativeLoanType,
        ficoChange: 0,
        ltvChange: 0,
        maxHomePrice: altMaxPrice,
        monthlyPayment: altMonthlyPayment,
      });
      
      // Scenario 2: Higher FICO score
      const nextFicoBand = getNextFicoBand(financials.ficoScore, loanDetails.loanType);
      
      if (nextFicoBand) {
        const betterFicoRate = calculateAdjustedRate(
          loanDetails.interestRate,
          nextFicoBand,
          loanDetails.ltv,
          loanDetails.loanType
        );
        
        const betterFicoPrice = calculateMaxPurchasePrice(
          financials.annualIncome,
          financials.monthlyDebts,
          maxDTI,
          betterFicoRate,
          loanDetails.propertyTax,
          loanDetails.propertyInsurance || 1200,
          100 - loanDetails.ltv,
          pmiRate
        );
        
        const betterFicoLoan = betterFicoPrice * (loanDetails.ltv / 100);
        
        const betterFicoPayment = calculateMonthlyPayment(
          betterFicoLoan,
          betterFicoRate,
          30,
          (loanDetails.propertyTax / 100) * betterFicoPrice,
          loanDetails.propertyInsurance || 1200,
          pmiRate
        );
        
        scenarios.push({
          loanType: loanDetails.loanType,
          ficoChange: nextFicoBand - financials.ficoScore,
          ltvChange: 0,
          maxHomePrice: betterFicoPrice,
          monthlyPayment: betterFicoPayment,
        });
      }
      
      // Scenario 3: Lower LTV (higher down payment)
      const lowerLtv = getLowerLtvOption(loanDetails.ltv);
      
      if (lowerLtv) {
        // Recalculate PMI based on lower LTV
        let lowerLtvPmiRate = 0;
        if (loanDetails.loanType === 'fha') {
          const mipRates = getFhaMipRates(loanAmount, lowerLtv);
          lowerLtvPmiRate = mipRates.annualMipPercent;
        } else if (lowerLtv > 80) {
          lowerLtvPmiRate = lowerLtv > 95 ? 1.1 : 
                      lowerLtv > 90 ? 0.8 : 
                      lowerLtv > 85 ? 0.5 : 0.3;
        }
        
        const lowerLtvRate = calculateAdjustedRate(
          loanDetails.interestRate,
          financials.ficoScore,
          lowerLtv,
          loanDetails.loanType
        );
        
        const lowerLtvPrice = calculateMaxPurchasePrice(
          financials.annualIncome,
          financials.monthlyDebts,
          maxDTI,
          lowerLtvRate,
          loanDetails.propertyTax,
          loanDetails.propertyInsurance || 1200,
          100 - lowerLtv,
          lowerLtvPmiRate
        );
        
        const lowerLtvLoan = lowerLtvPrice * (lowerLtv / 100);
        
        const lowerLtvPayment = calculateMonthlyPayment(
          lowerLtvLoan,
          lowerLtvRate,
          30,
          (loanDetails.propertyTax / 100) * lowerLtvPrice,
          loanDetails.propertyInsurance || 1200,
          lowerLtvPmiRate
        );
        
        scenarios.push({
          loanType: loanDetails.loanType,
          ficoChange: 0,
          ltvChange: lowerLtv - loanDetails.ltv,
          maxHomePrice: lowerLtvPrice,
          monthlyPayment: lowerLtvPayment,
        });
      }
      
      // Update results in context
      updateResults({
        maxHomePrice: maxPurchasePrice,
        monthlyPayment: monthlyPayment,
        scenarios: scenarios,
      });
      
      toast.success("Mortgage calculation completed!");
    } catch (error) {
      console.error("Calculation error:", error);
      toast.error("An error occurred during calculation. Please try again.");
      setValidationError("There was a problem with the calculation. Please check your inputs.");
    } finally {
      setIsCalculating(false);
    }
  };
  
  useEffect(() => {
    if (!userData.results.maxHomePrice) {
      calculateResults();
    }
  }, []);
  
  const formatCurrency = (value: number | null): string => {
    if (value === null) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const goToPreviousStep = () => {
    setCurrentStep(2); // Go back to Loan Details step
  };
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Your Mortgage Results
        </CardTitle>
        <CardDescription>
          Based on your inputs, here's what you can afford.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {validationError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Missing Information</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
            <div className="mt-4">
              <Button onClick={goToPreviousStep} variant="outline" className="mt-2">
                Go Back to Previous Step
              </Button>
            </div>
          </Alert>
        ) : (
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="primary">Your Results</TabsTrigger>
              <TabsTrigger value="scenarios">Improvement Scenarios</TabsTrigger>
            </TabsList>
            <TabsContent value="primary" className="space-y-6 pt-4">
              {userData.results.maxHomePrice ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="financial-card text-center">
                      <h3 className="text-lg font-medium mb-2">Maximum Home Price</h3>
                      <p className="text-3xl font-bold text-finance-blue">
                        {formatCurrency(userData.results.maxHomePrice)}
                      </p>
                    </div>
                    
                    <div className="financial-card text-center">
                      <h3 className="text-lg font-medium mb-2">Monthly Payment</h3>
                      <p className="text-3xl font-bold text-finance-navy">
                        {formatCurrency(userData.results.monthlyPayment)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="financial-card">
                    <h3 className="text-lg font-medium mb-3">Mortgage Summary</h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b">
                        <span>Loan Type:</span>
                        <span className="font-medium">{userData.loanDetails.loanType === 'conventional' ? 'Conventional' : 'FHA'}</span>
                      </div>
                      
                      <div className="flex justify-between py-1 border-b">
                        <span>Down Payment:</span>
                        <span className="font-medium">{100 - userData.loanDetails.ltv}% ({formatCurrency(userData.results.maxHomePrice ? userData.results.maxHomePrice * ((100 - userData.loanDetails.ltv) / 100) : null)})</span>
                      </div>
                      
                      <div className="flex justify-between py-1 border-b">
                        <span>Loan Amount:</span>
                        <span className="font-medium">{formatCurrency(userData.results.maxHomePrice ? userData.results.maxHomePrice * (userData.loanDetails.ltv / 100) : null)}</span>
                      </div>
                      
                      <div className="flex justify-between py-1 border-b">
                        <span>Interest Rate:</span>
                        <span className="font-medium">{userData.loanDetails.interestRate ? userData.loanDetails.interestRate.toFixed(2) : 'N/A'}%</span>
                      </div>
                      
                      <div className="flex justify-between py-1 border-b">
                        <span>Loan Term:</span>
                        <span className="font-medium">30 Years</span>
                      </div>
                      
                      <div className="flex justify-between py-1 border-b">
                        <span>Property Tax:</span>
                        <span className="font-medium">${userData.loanDetails.propertyTax ? ((userData.loanDetails.propertyTax / 100) * (userData.results.maxHomePrice || 0) / 12).toFixed(0) : 'N/A'}/month</span>
                      </div>
                      
                      <div className="flex justify-between py-1">
                        <span>Property Insurance:</span>
                        <span className="font-medium">${userData.loanDetails.propertyInsurance ? (userData.loanDetails.propertyInsurance / 12).toFixed(0) : 'N/A'}/month</span>
                      </div>
                      
                      {userData.loanDetails.loanType === 'fha' && (
                        <div className="flex justify-between py-1 border-t">
                          <span>Upfront MIP:</span>
                          <span className="font-medium">{formatCurrency(userData.results.maxHomePrice && userData.loanDetails.upfrontMIP ? 
                            (userData.results.maxHomePrice * (userData.loanDetails.ltv / 100) * (userData.loanDetails.upfrontMIP / 100)) : null)}
                          </span>
                        </div>
                      )}
                      
                      {userData.loanDetails.ltv > 80 && (
                        <div className="flex justify-between py-1 border-t">
                          <span>{userData.loanDetails.loanType === 'fha' ? 'Monthly MIP:' : 'Monthly PMI:'}</span>
                          <span className="font-medium">Included in payment</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-lg text-muted-foreground mb-4">Calculating your results...</p>
                  <Button onClick={calculateResults} disabled={isCalculating}>
                    {isCalculating ? "Calculating..." : "Recalculate"}
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="scenarios" className="pt-4">
              <div className="space-y-6">
                <div className="financial-card">
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Ways to Increase Your Buying Power
                  </h3>
                  
                  {userData.results.scenarios && userData.results.scenarios.length > 0 ? (
                    <div className="space-y-6">
                      {userData.results.scenarios.map((scenario, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-medium text-finance-blue">
                            {scenario.loanType !== userData.loanDetails.loanType
                              ? `Switch to ${scenario.loanType === 'conventional' ? 'Conventional' : 'FHA'} Loan`
                              : scenario.ficoChange > 0
                              ? `Increase FICO Score by ${scenario.ficoChange} points`
                              : scenario.ltvChange < 0
                              ? `Increase Down Payment to ${100 - (userData.loanDetails.ltv + scenario.ltvChange)}%`
                              : 'Alternative Scenario'}
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">New Home Price</p>
                              <p className="font-medium">{formatCurrency(scenario.maxHomePrice)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">New Monthly Payment</p>
                              <p className="font-medium">{formatCurrency(scenario.monthlyPayment)}</p>
                            </div>
                          </div>
                          
                          <div className="pt-1">
                            <p className="text-sm font-medium flex items-center gap-1">
                              <span className={scenario.maxHomePrice > (userData.results.maxHomePrice || 0) ? "text-finance-green" : "text-destructive"}>
                                {scenario.maxHomePrice > (userData.results.maxHomePrice || 0)
                                  ? `+${formatCurrency(scenario.maxHomePrice - (userData.results.maxHomePrice || 0))} buying power`
                                  : `${formatCurrency(scenario.maxHomePrice - (userData.results.maxHomePrice || 0))} buying power`}
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      <div className="text-sm text-muted-foreground pt-2">
                        <p>These scenarios are estimates based on current rates and your inputs. Actual loan terms may vary.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No alternative scenarios available.</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setCurrentStep(2)}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {!validationError && (
          <Button 
            onClick={() => setCurrentStep(4)}
            className="flex items-center gap-1"
          >
            Goal Setting <ArrowRightCircle className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ResultsStep;
