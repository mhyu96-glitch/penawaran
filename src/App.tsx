import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QuoteGenerator from "./pages/QuoteGenerator";
import { AuthProvider } from "./contexts/SessionContext";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import QuoteList from "./pages/QuoteList";
import QuoteView from "./pages/QuoteView";
import Profile from "./pages/Profile";
import SharedLayout from "./components/SharedLayout";
import ClientList from "./pages/ClientList";
import Dashboard from "./pages/Dashboard";
import ItemList from "./pages/ItemList";
import Settings from "./pages/Settings";
import ClientDetail from "./pages/ClientDetail";
import InvoiceList from "./pages/InvoiceList";
import InvoiceGenerator from "./pages/InvoiceGenerator";
import InvoiceView from "./pages/InvoiceView";
import ExpenseList from "./pages/ExpenseList";
import Reports from "./pages/Reports";
import ProfitabilityReports from "./pages/ProfitabilityReports";
import PublicQuoteView from "./pages/PublicQuoteView";
import PublicInvoiceView from "./pages/PublicInvoiceView";
import ClientPortal from "./pages/ClientPortal";
import { ThemeProvider } from "./components/ThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/quote/public/:id" element={<PublicQuoteView />} />
              <Route path="/invoice/public/:id" element={<PublicInvoiceView />} />
              <Route path="/portal/:accessKey" element={<ClientPortal />} />
              
              <Route element={<ProtectedRoute />}>
                <Route element={<SharedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/quotes" element={<QuoteList />} />
                  <Route path="/quote/new" element={<QuoteGenerator />} />
                  <Route path="/quote/edit/:id" element={<QuoteGenerator />} />
                  <Route path="/quote/:id" element={<QuoteView />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/clients" element={<ClientList />} />
                  <Route path="/client/:id" element={<ClientDetail />} />
                  <Route path="/items" element={<ItemList />} />
                  <Route path="/invoices" element={<InvoiceList />} />
                  <Route path="/invoice/new" element={<InvoiceGenerator />} />
                  <Route path="/invoice/edit/:id" element={<InvoiceGenerator />} />
                  <Route path="/invoice/:id" element={<InvoiceView />} />
                  <Route path="/expenses" element={<ExpenseList />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/profitability" element={<ProfitabilityReports />} />
                </Route>
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;