import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import Listings from "@/pages/Listings";
import Bookings from "@/pages/Bookings";
import Documents from "@/pages/Documents";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import AdminLogs from "@/pages/AdminLogs";
import Pricing from "@/pages/Pricing";
import ProviderPrices from "@/pages/ProviderPrices";
import PromoCodes from "@/pages/PromoCodes";
import PlatformWallet from "@/pages/PlatformWallet";
import GoldAnalytics from "@/pages/GoldAnalytics";
import WheelAnalytics from "@/pages/WheelAnalytics";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoutes() {
  const { auth } = useAuth();
  if (!auth) return <Redirect to="/login" />;
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/listings" component={Listings} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/documents" component={Documents} />
        <Route path="/reports" component={Reports} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/logs" component={AdminLogs} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/provider-prices" component={ProviderPrices} />
        <Route path="/promo-codes" component={PromoCodes} />
        <Route path="/platform-wallet" component={PlatformWallet} />
        <Route path="/gold-analytics" component={GoldAnalytics} />
        <Route path="/wheel-analytics" component={WheelAnalytics} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  const { auth } = useAuth();
  return (
    <Switch>
      <Route path="/login">
        {auth ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
