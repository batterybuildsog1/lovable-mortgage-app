
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMortgage } from "@/context/MortgageContext";
import { MapPin } from "lucide-react";

const LocationStep: React.FC = () => {
  const { userData, updateLocation, setCurrentStep } = useMortgage();
  const [formData, setFormData] = useState({
    city: userData.location.city,
    state: userData.location.state,
    zipCode: userData.location.zipCode,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }
    
    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    } else if (formData.state.length !== 2) {
      newErrors.state = "Please use 2-letter state code (e.g., CA)";
    }
    
    if (!formData.zipCode.trim()) {
      newErrors.zipCode = "ZIP code is required";
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode)) {
      newErrors.zipCode = "Please enter a valid ZIP code";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      updateLocation(formData);
      toast.success("Location information saved!");
      setCurrentStep(1);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Where are you looking to buy?
        </CardTitle>
        <CardDescription>
          We'll use this information to provide accurate estimates for property taxes and insurance rates in your area.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Enter city name"
            />
            {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="state">State (2-letter code)</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="CA"
              maxLength={2}
            />
            {errors.state && <p className="text-sm text-destructive">{errors.state}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="zipCode">ZIP Code</Label>
            <Input
              id="zipCode"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              placeholder="12345"
            />
            {errors.zipCode && <p className="text-sm text-destructive">{errors.zipCode}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">Continue</Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default LocationStep;
