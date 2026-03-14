import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ToursList from "@/pages/tours/ToursList";
import TourForm from "@/pages/tours/TourForm";
import CarsList from "@/pages/cars/CarsList";
import CarForm from "@/pages/cars/CarForm";
import LocationsList from "@/pages/locations/LocationsList";
import AttributesList from "@/pages/attributes/AttributesList";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import RolesPage from "@/pages/admin/RolesPage";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/register";

  if (isAuthPage) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />

        <Route path="/tours" component={ToursList} />
        <Route path="/tours/new" component={TourForm} />
        <Route path="/tours/:id" component={TourForm} />

        <Route path="/cars" component={CarsList} />
        <Route path="/cars/new" component={CarForm} />
        <Route path="/cars/:id" component={CarForm} />

        <Route path="/locations" component={LocationsList} />
        <Route path="/attributes" component={AttributesList} />

        <Route path="/profile" component={ProfilePage} />
        <Route path="/admin/roles" component={RolesPage} />

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
