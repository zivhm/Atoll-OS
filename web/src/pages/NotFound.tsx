import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="mb-2 text-4xl font-semibold tracking-tight">You&apos;ve drifted off course</h1>
      <p className="mb-8 max-w-md text-lg text-muted-foreground">
        This page does not exist. Return to helpers to keep managing everything in one place.
      </p>
      <Link to="/dashboard">
        <Button size="lg">Back to helpers</Button>
      </Link>
    </div>
  );
};

export default NotFound;
