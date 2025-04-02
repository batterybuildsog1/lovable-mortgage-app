
import MortgageCalculator from "@/components/MortgageCalculator";
import { MortgageProvider } from "@/context/MortgageContext";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Mortgage Calculator | Home Buying Empowerment Tool</title>
        <meta name="description" content="Calculate how much home you can afford and create a roadmap to homeownership" />
      </Helmet>
      <MortgageProvider>
        <div className="min-h-screen bg-background">
          <MortgageCalculator />
        </div>
      </MortgageProvider>
    </>
  );
};

export default Index;
