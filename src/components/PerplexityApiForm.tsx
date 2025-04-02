
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PerplexityApiFormProps {
  onApiKeySet: (apiKey: string) => void;
  errorMessage?: string | null;
}

const PerplexityApiForm: React.FC<PerplexityApiFormProps> = ({ onApiKeySet, errorMessage }) => {
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast.error("Please enter a valid Perplexity API key");
      return;
    }

    if (!apiKey.startsWith("pplx-")) {
      toast.error("API key should start with 'pplx-'");
      return;
    }

    setIsSubmitting(true);
    try {
      // Store the API key in local storage
      localStorage.setItem("perplexity_api_key", apiKey);
      onApiKeySet(apiKey);
      toast.success("API key saved successfully");
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Perplexity API Key Required
          </CardTitle>
          <CardDescription>
            This application uses Perplexity's Sonar API to fetch real-time mortgage data.
            Please provide your API key to continue.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="api-key">Perplexity API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Your API key is stored locally on your device and is never sent to our servers.
                </p>
                <p>
                  Visit <a href="https://www.perplexity.ai/settings/api" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Perplexity API settings</a> to get your API key.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save API Key"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default PerplexityApiForm;
