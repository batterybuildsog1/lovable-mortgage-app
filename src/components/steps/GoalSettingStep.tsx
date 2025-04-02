
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMortgage } from "@/context/MortgageContext";
import { Target, ArrowLeft, Plus, Trash2, Home } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { getNextFicoBand, getLowerLtvOption } from "@/utils/mortgageCalculations";
import { Progress } from "@/components/ui/progress";

const GoalSettingStep: React.FC = () => {
  const { userData, updateGoals, setCurrentStep, resetCalculator } = useMortgage();
  
  const [goals, setGoals] = useState({
    targetFICO: userData.goals.targetFICO || userData.financials.ficoScore,
    targetDownPayment: userData.goals.targetDownPayment || userData.financials.downPayment,
    monthlyExpenses: userData.goals.monthlyExpenses || {},
    savingRate: userData.goals.savingRate || 0,
  });
  
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  
  // Calculate the next FICO score goal if not already set
  useEffect(() => {
    if (!goals.targetFICO || goals.targetFICO <= userData.financials.ficoScore) {
      const nextFico = getNextFicoBand(userData.financials.ficoScore, userData.loanDetails.loanType);
      if (nextFico) {
        setGoals(prev => ({ ...prev, targetFICO: nextFico }));
      }
    }
    
    // Recommend a better down payment if available
    if (!goals.targetDownPayment || goals.targetDownPayment <= userData.financials.downPayment) {
      // Get lower LTV option and convert to down payment amount
      const lowerLtv = getLowerLtvOption(userData.loanDetails.ltv);
      if (lowerLtv && userData.results.maxHomePrice) {
        // Calculate target down payment based on the current max home price
        const targetDownPaymentPercentage = 100 - lowerLtv;
        const targetDownPaymentAmount = userData.results.maxHomePrice * (targetDownPaymentPercentage / 100);
        setGoals(prev => ({ ...prev, targetDownPayment: targetDownPaymentAmount }));
      }
    }
  }, []);
  
  const addExpense = () => {
    if (!expenseName.trim()) {
      toast.error("Please enter an expense name");
      return;
    }
    
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }
    
    setGoals(prev => ({
      ...prev,
      monthlyExpenses: {
        ...prev.monthlyExpenses,
        [expenseName.trim()]: amount,
      },
    }));
    
    setExpenseName("");
    setExpenseAmount("");
    toast.success(`Added ${expenseName} to your expenses`);
  };
  
  const removeExpense = (name: string) => {
    const updatedExpenses = { ...goals.monthlyExpenses };
    delete updatedExpenses[name];
    
    setGoals(prev => ({
      ...prev,
      monthlyExpenses: updatedExpenses,
    }));
    
    toast.success(`Removed ${name} from your expenses`);
  };
  
  const handleSubmit = () => {
    updateGoals(goals);
    toast.success("Financial goals saved!");
  };
  
  // Calculate total monthly expenses
  const totalMonthlyExpenses = Object.values(goals.monthlyExpenses).reduce(
    (sum, amount) => sum + amount, 
    0
  );
  
  // Calculate monthly income (simplified, using annual income / 12)
  const monthlyIncome = userData.financials.annualIncome / 12;
  
  // Calculate monthly savings
  const monthlySavings = monthlyIncome - totalMonthlyExpenses - userData.financials.monthlyDebts;
  
  // Calculate months to reach down payment goal
  const additionalDownPaymentNeeded = goals.targetDownPayment - userData.financials.downPayment;
  const monthsToDownPaymentGoal = monthlySavings > 0 
    ? Math.ceil(additionalDownPaymentNeeded / monthlySavings)
    : Infinity;
  
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Set Your Homeownership Goals
        </CardTitle>
        <CardDescription>
          Track your progress towards homeownership by setting financial goals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* FICO Score Goal */}
          <div className="financial-card">
            <h3 className="text-lg font-medium mb-3">Credit Score Goal</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Current FICO Score:</span>
                <span className="font-medium">{userData.financials.ficoScore}</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="targetFICO">Target FICO Score: {goals.targetFICO}</Label>
                <Slider
                  id="targetFICO"
                  min={Math.max(userData.financials.ficoScore, 500)}
                  max={850}
                  step={5}
                  value={[goals.targetFICO || userData.financials.ficoScore]}
                  onValueChange={(value) => setGoals({ ...goals, targetFICO: value[0] })}
                />
              </div>
              
              {goals.targetFICO > userData.financials.ficoScore && (
                <div className="pt-2">
                  <p className="text-sm text-finance-blue font-medium">
                    Improving your score to {goals.targetFICO} could increase your buying power!
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Down Payment Goal */}
          <div className="financial-card">
            <h3 className="text-lg font-medium mb-3">Down Payment Goal</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Current Down Payment:</span>
                <span className="font-medium">{formatCurrency(userData.financials.downPayment)}</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="targetDownPayment">Target Down Payment</Label>
                <div className="relative">
                  <Input
                    id="targetDownPayment"
                    type="number"
                    value={goals.targetDownPayment || ""}
                    onChange={(e) => setGoals({ ...goals, targetDownPayment: parseFloat(e.target.value) || 0 })}
                    className="pl-10"
                  />
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                </div>
              </div>
              
              {goals.targetDownPayment > userData.financials.downPayment && monthlySavings > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-sm text-muted-foreground">At your current savings rate:</p>
                  <p className="text-sm font-medium">
                    {monthsToDownPaymentGoal < 60 ? (
                      <>You'll reach your goal in <span className="text-finance-blue">{monthsToDownPaymentGoal} months</span></>
                    ) : (
                      <>Consider increasing your monthly savings to reach your goal faster</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Monthly Budget Tracker */}
        <div className="financial-card">
          <h3 className="text-lg font-medium mb-4">Monthly Budget Tracker</h3>
          
          <div className="space-y-5">
            {/* Income Display */}
            <div className="flex justify-between pb-2 border-b">
              <span>Monthly Income (pre-tax):</span>
              <span className="font-medium">{formatCurrency(monthlyIncome)}</span>
            </div>
            
            {/* Expenses List */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Monthly Expenses:</span>
                <span className="font-medium">{formatCurrency(totalMonthlyExpenses)}</span>
              </div>
              
              {Object.entries(goals.monthlyExpenses).map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center text-sm">
                  <span>{name}</span>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(amount)}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeExpense(name)}
                      className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Add New Expense */}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Expense name"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="flex-1"
                />
                <div className="relative w-32">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="pl-6"
                  />
                  <span className="absolute left-2 top-2 text-muted-foreground">$</span>
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={addExpense}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Current Debts */}
            <div className="flex justify-between pt-2 border-t">
              <span>Monthly Debt Payments:</span>
              <span className="font-medium">{formatCurrency(userData.financials.monthlyDebts)}</span>
            </div>
            
            {/* Calculated Savings */}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium">Monthly Savings:</span>
              <span className={`font-medium ${monthlySavings > 0 ? "text-finance-green" : "text-destructive"}`}>
                {formatCurrency(monthlySavings)}
              </span>
            </div>
            
            {/* Savings Rate */}
            <div className="space-y-2 pt-3">
              <div className="flex justify-between">
                <Label htmlFor="savingsRate">Portion of savings for home purchase</Label>
                <span>{goals.savingRate}%</span>
              </div>
              <Slider
                id="savingsRate"
                min={0}
                max={100}
                step={5}
                value={[goals.savingRate]}
                onValueChange={(value) => setGoals({ ...goals, savingRate: value[0] })}
              />
              
              {monthlySavings > 0 && goals.savingRate > 0 && (
                <div className="text-sm pt-2">
                  <p>
                    Putting aside {formatCurrency(monthlySavings * (goals.savingRate / 100))}/month for your down payment
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Progress Summary */}
        <div className="financial-card">
          <h3 className="text-lg font-medium mb-3">Your Homebuying Progress</h3>
          
          <div className="space-y-4">
            {/* Down Payment Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Down Payment Progress:</span>
                <span>
                  {formatCurrency(userData.financials.downPayment)} of {formatCurrency(goals.targetDownPayment)}
                </span>
              </div>
              <Progress value={(userData.financials.downPayment / goals.targetDownPayment) * 100} />
            </div>
            
            {/* Credit Score Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Credit Score Progress:</span>
                <span>
                  {userData.financials.ficoScore} of {goals.targetFICO}
                </span>
              </div>
              <Progress 
                value={((userData.financials.ficoScore - 300) / (goals.targetFICO - 300)) * 100} 
                className="h-2"
              />
            </div>
            
            {/* Estimated Timeline */}
            {monthlySavings > 0 && goals.savingRate > 0 && (
              <div className="pt-2 text-sm">
                <p className="font-medium">
                  At your current savings rate of {formatCurrency(monthlySavings * (goals.savingRate / 100))}/month:
                </p>
                
                {goals.targetDownPayment > userData.financials.downPayment ? (
                  <p className="mt-1">
                    You'll reach your down payment goal in approximately{" "}
                    <span className="font-medium text-finance-blue">
                      {Math.ceil(
                        (goals.targetDownPayment - userData.financials.downPayment) / 
                        (monthlySavings * (goals.savingRate / 100))
                      )}{" "}
                      months
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-finance-green">
                    You've already reached your down payment goal!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setCurrentStep(3)}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              handleSubmit();
              resetCalculator();
            }}
          >
            Start New Calculation
          </Button>
          <Button onClick={handleSubmit} className="flex items-center gap-1">
            <Home className="h-4 w-4 mr-1" /> Save Goals
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default GoalSettingStep;
